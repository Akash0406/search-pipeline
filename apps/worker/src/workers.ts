/**
 * BullMQ worker registration for every pipeline queue (Design Worker §9).
 *
 * Each worker dispatches to its pure stage handler. Failures are isolated by
 * BullMQ (a thrown job never crashes the process or sibling jobs — Req 55); on
 * exhausted retries we record the failure against the connection/run and move
 * the job to its DLQ (Req 20.4, 24.3, 27.3). Correlation ids ride on the job
 * payloads and are threaded into every stage's structured logs.
 */

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PipelineContext } from './context.js';
import { DeadLetterQueues, isExhausted, recordStageFailure } from './dlq.js';
import {
  QUEUE_NAMES,
  type DeduplicationJobData,
  type DiscoveryJobData,
  type ExpiryCheckJobData,
  type ExportJobData,
  type FetchJobData,
  type NormalizationJobData,
  type OutboxDispatchJobData,
  type ParseJobData,
  type QueueName,
  type RetentionCleanupJobData,
} from './queues.js';
import { runDiscovery } from './stages/discovery.js';
import { runFetch } from './stages/fetch.js';
import { runParse } from './stages/parse.js';
import { runNormalize } from './stages/normalize.js';
import { runDedup } from './stages/dedup.js';
import { runExpiryCheck } from './stages/expiry.js';
import { runRetentionCleanup } from './stages/retention.js';
import { runOutboxDispatch } from './stages/outbox.js';
import { runExportJob } from './stages/export.js';

/** Per-queue concurrency. Fetch stays modest — SafeFetcher rate-limits anyway. */
const CONCURRENCY: Record<QueueName, number> = {
  [QUEUE_NAMES.connectorDiscovery]: 2,
  [QUEUE_NAMES.sourceFetch]: 5,
  [QUEUE_NAMES.artifactParse]: 5,
  [QUEUE_NAMES.normalization]: 5,
  [QUEUE_NAMES.deduplication]: 2,
  [QUEUE_NAMES.expiryCheck]: 1,
  [QUEUE_NAMES.retentionCleanup]: 1,
  [QUEUE_NAMES.outboxDispatch]: 1,
  [QUEUE_NAMES.dataExport]: 2,
};

/** A running set of workers with a graceful close. */
export interface WorkerSet {
  workers: Worker[];
  close: () => Promise<void>;
}

/**
 * Start all pipeline workers. `signal` reflects process shutdown so
 * long-running stages (discovery/fetch/parse) can bail cooperatively.
 */
export function startWorkers(
  ctx: PipelineContext,
  connection: ConnectionOptions,
  dlq: DeadLetterQueues,
  signal: AbortSignal,
): WorkerSet {
  const workers: Worker[] = [];

  const register = <T>(
    name: QueueName,
    handler: (data: T, job: Job<T>) => Promise<unknown>,
  ): Worker<T> => {
    const worker = new Worker<T>(name, async (job) => handler(job.data, job), {
      connection,
      concurrency: CONCURRENCY[name],
    });

    worker.on('failed', (job, err) => {
      const reason = err instanceof Error ? err.message : String(err);
      ctx.logger.warn('worker.job_failed', {
        stage: name,
        outcome: 'failure',
        error: err,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      });
      if (job && isExhausted(job)) {
        // Exhausted retries → record against connection/run + dead-letter.
        void recordStageFailure(ctx.db, ctx.logger, job.data, reason);
        void dlq.deadLetter(name, job, reason).catch((dlqErr: unknown) => {
          ctx.logger.error('worker.dead_letter_failed', {
            stage: name,
            outcome: 'failure',
            error: dlqErr,
          });
        });
      }
    });

    worker.on('error', (err) => {
      ctx.logger.error('worker.error', { stage: name, outcome: 'failure', error: err });
    });

    workers.push(worker as Worker);
    return worker;
  };

  register<DiscoveryJobData>(QUEUE_NAMES.connectorDiscovery, (data) =>
    runDiscovery(ctx, data, signal),
  );
  register<FetchJobData>(QUEUE_NAMES.sourceFetch, (data) => runFetch(ctx, data, signal));
  register<ParseJobData>(QUEUE_NAMES.artifactParse, (data) => runParse(ctx, data, signal));
  register<NormalizationJobData>(QUEUE_NAMES.normalization, (data) => runNormalize(ctx, data));
  register<DeduplicationJobData>(QUEUE_NAMES.deduplication, (data) => runDedup(ctx, data));
  register<ExpiryCheckJobData>(QUEUE_NAMES.expiryCheck, (data) => runExpiryCheck(ctx, data));
  register<RetentionCleanupJobData>(QUEUE_NAMES.retentionCleanup, (data) =>
    runRetentionCleanup(ctx, data),
  );
  register<OutboxDispatchJobData>(QUEUE_NAMES.outboxDispatch, (data) =>
    runOutboxDispatch(ctx, data),
  );
  register<ExportJobData>(QUEUE_NAMES.dataExport, (data) => runExportJob(ctx, data));

  return {
    workers,
    close: async () => {
      // Stop accepting new jobs and let in-flight jobs drain (Design Worker §9).
      await Promise.all(workers.map((w) => w.close()));
    },
  };
}
