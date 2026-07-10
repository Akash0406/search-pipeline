/**
 * Worker bootstrap (Task 10.3): construct the Redis connection, DB client,
 * SafeFetcher (with the shared Redis-backed per-domain rate limiter), connector
 * registry, object storage, checkpoint store, all pipeline queues + workers,
 * and start the scheduler.
 *
 * Wiring is eager but performs no network I/O until a job runs, so bootstrap
 * itself does not require live Redis/Postgres/MinIO. Connectivity is exercised
 * only when the pipeline actually processes work.
 */

import type { ConnectionOptions } from 'bullmq';
import { loadConfig } from '@careerstack/config';
import { createDefaultRegistry } from '@careerstack/connectors';
import { createDb, type DbHandle } from '@careerstack/database';
import { createLogger, type Logger } from '@careerstack/observability';
import {
  RedisRateLimiter,
  SafeFetcher,
  rateLimiterOptionsFromConfig,
  type RedisEvalClient,
  type SafeFetcherConfig,
} from '@careerstack/security';
import { DbCheckpointStore } from './checkpoint-store.js';
import { closeQueues, createQueues, type PipelineContext } from './context.js';
import { DeadLetterQueues } from './dlq.js';
import { createRedisConnection } from './redis.js';
import { Scheduler } from './scheduler.js';
import { S3ArtifactStore } from './storage/artifact-store.js';
import { startWorkers, type WorkerSet } from './workers.js';

/** A running worker; call {@link WorkerRuntime.shutdown} to drain + close. */
export interface WorkerRuntime {
  pipeline: PipelineContext;
  workers: WorkerSet;
  scheduler: Scheduler;
  shutdown: () => Promise<void>;
}

/** Build the SafeFetcher's static config, omitting empty domain lists. */
function safeFetcherConfig(
  userAgent: string,
  allowed: string[],
  denied: string[],
): SafeFetcherConfig {
  return {
    userAgent,
    ...(allowed.length > 0 ? { allowedDomains: allowed } : {}),
    ...(denied.length > 0 ? { deniedDomains: denied } : {}),
  };
}

/** Bootstrap all worker wiring and start consuming. */
export async function bootstrap(logger: Logger = createLogger('worker')): Promise<WorkerRuntime> {
  const config = loadConfig();

  // Shared BullMQ connection + a dedicated connection for the rate limiter so
  // its atomic script never contends with blocking queue operations.
  const bullConnection = createRedisConnection(config.redis.redisUrl);
  const rateLimitConnection = createRedisConnection(config.redis.redisUrl);
  const connection = bullConnection as unknown as ConnectionOptions;

  const dbHandle: DbHandle = createDb({ connectionString: config.db.databaseUrl });

  const rateLimitEval: RedisEvalClient = {
    eval: (script, numKeys, ...args) =>
      rateLimitConnection.eval(script, numKeys, ...args) as Promise<unknown>,
  };
  const rateLimiter = new RedisRateLimiter(
    rateLimitEval,
    rateLimiterOptionsFromConfig(config.rateLimit),
  );

  const fetcher = new SafeFetcher({
    config: safeFetcherConfig(
      config.fetch.userAgent,
      config.fetch.allowedDomains,
      config.fetch.deniedDomains,
    ),
    rateLimiter,
    logger,
  });

  const pipeline: PipelineContext = {
    db: dbHandle.db,
    config,
    logger,
    registry: createDefaultRegistry(),
    fetcher,
    storage: new S3ArtifactStore(config.storage),
    checkpointStore: new DbCheckpointStore(dbHandle.db),
    queues: createQueues(connection, config),
  };

  const dlq = new DeadLetterQueues(connection);
  const shutdownController = new AbortController();
  const workers = startWorkers(pipeline, connection, dlq, shutdownController.signal);
  const scheduler = new Scheduler(pipeline);
  scheduler.start();

  logger.info('worker.started', { stage: 'bootstrap', outcome: 'success' });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('worker.shutdown.begin', { stage: 'bootstrap' });
    // Stop scheduling, signal in-flight loops, then drain and close.
    scheduler.stop();
    shutdownController.abort();
    await workers.close();
    await closeQueues(pipeline.queues);
    await dlq.close();
    await dbHandle.close();
    await Promise.all([bullConnection.quit(), rateLimitConnection.quit()]);
    logger.info('worker.shutdown.complete', { stage: 'bootstrap', outcome: 'success' });
  };

  return { pipeline, workers, scheduler, shutdown };
}
