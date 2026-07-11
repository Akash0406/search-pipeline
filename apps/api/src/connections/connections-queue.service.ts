/**
 * Connection-job producer (Req 24 / SRC-005, Req 23 / SRC-004, RES-002).
 *
 * Enqueues jobs onto the BullMQ queues consumed by `apps/worker`:
 *   - `connector-discovery` — run `connector.discover` for one connection; the
 *     worker's discovery stage then fans out `source-fetch` jobs per discovered
 *     reference (Design Worker §9). This is the entry point for both a manual
 *     "run now" (SRC-005) and a manual-URL submission (SRC-004): the
 *     `manual_url` connector's `discover` yields the single submitted URL.
 *   - `source-fetch` — fetch one already-discovered reference. Exposed for
 *     completeness of the producer contract; the discovery stage is the normal
 *     producer of these jobs.
 *
 * The queue name + payload shapes are the cross-process contract with the
 * worker (mirrors its `QUEUE_NAMES` / `DiscoveryJobData` / `FetchJobData`).
 *
 * Following the export-queue pattern, the Redis connection + queues are created
 * LAZILY on first enqueue, so the API has no Redis coupling at boot: if Redis is
 * unavailable the failure surfaces on the request (a 5xx) rather than crashing
 * the process.
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import type { Config } from '@careerstack/config';
import type { Logger } from '@careerstack/observability';
import type { DiscoveryRef, SourceType } from '@careerstack/connectors';
import { CONFIG, LOGGER } from '../common/di-tokens.js';

/** Shared queue names with the worker (`QUEUE_NAMES.connectorDiscovery`/`sourceFetch`). */
export const CONNECTOR_DISCOVERY_QUEUE_NAME = 'connector-discovery' as const;
export const SOURCE_FETCH_QUEUE_NAME = 'source-fetch' as const;

/** Mirrors the worker's `DiscoveryJobData`. */
export interface DiscoveryJobData {
  connectionId: string;
  correlationId: string;
  /** Existing run id opened at trigger time; the worker attaches counts to it. */
  runId?: string;
}

/** Mirrors the worker's `FetchJobData`. */
export interface FetchJobData {
  connectionId: string;
  runId: string;
  correlationId: string;
  sourceType: SourceType;
  ref: DiscoveryRef;
}

@Injectable()
export class ConnectionsQueue implements OnModuleDestroy {
  private connection?: Redis;
  private discoveryQueue?: Queue<DiscoveryJobData>;
  private fetchQueue?: Queue<FetchJobData>;
  private readonly redisUrl: string;
  private readonly attempts: number;
  private readonly backoffBaseMs: number;

  constructor(
    @Inject(CONFIG) config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    this.redisUrl = config.redis.redisUrl;
    this.attempts = config.rateLimit.maxRetries + 1;
    this.backoffBaseMs = config.rateLimit.backoffBaseMs;
  }

  /**
   * Enqueue a discovery job for a connection. Keyed by `runId` so a duplicate
   * enqueue for the same triggered run collapses onto one job (idempotent,
   * at-least-once).
   */
  async enqueueDiscovery(data: DiscoveryJobData): Promise<void> {
    await this.getDiscoveryQueue().add('discover', data, {
      ...(data.runId ? { jobId: `discover:${data.runId}` } : {}),
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffBaseMs },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    });
  }

  /**
   * Enqueue a single fetch job. Keyed by connection + ref dedup key to match the
   * worker's own idempotency scheme so re-enqueues collapse onto one job.
   */
  async enqueueFetch(data: FetchJobData): Promise<void> {
    await this.getFetchQueue().add('fetch', data, {
      jobId: `fetch:${data.connectionId}:${data.ref.dedupKey}`,
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffBaseMs },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    });
  }

  /** Construct (once) the shared Redis connection with no I/O at boot. */
  private getConnection(): ConnectionOptions {
    if (!this.connection) {
      // BullMQ requires maxRetriesPerRequest: null on its connection.
      this.connection = new Redis(this.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      // Log (never crash on) connection errors; ioredis retries in the background.
      this.connection.on('error', (err: unknown) => {
        this.logger.warn('connections.queue.redis_error', { error: err });
      });
    }
    // ioredis is a transitive dep of bullmq; cast to BullMQ's ConnectionOptions
    // (the worker + export queue use the same pattern) to avoid a spurious
    // dual-version structural mismatch under exactOptionalPropertyTypes.
    return this.connection as unknown as ConnectionOptions;
  }

  private getDiscoveryQueue(): Queue<DiscoveryJobData> {
    if (this.discoveryQueue) return this.discoveryQueue;
    this.discoveryQueue = new Queue<DiscoveryJobData>(CONNECTOR_DISCOVERY_QUEUE_NAME, {
      connection: this.getConnection(),
    });
    this.discoveryQueue.on('error', (err: unknown) => {
      this.logger.warn('connections.queue.discovery_error', { error: err });
    });
    return this.discoveryQueue;
  }

  private getFetchQueue(): Queue<FetchJobData> {
    if (this.fetchQueue) return this.fetchQueue;
    this.fetchQueue = new Queue<FetchJobData>(SOURCE_FETCH_QUEUE_NAME, {
      connection: this.getConnection(),
    });
    this.fetchQueue.on('error', (err: unknown) => {
      this.logger.warn('connections.queue.fetch_error', { error: err });
    });
    return this.fetchQueue;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.discoveryQueue) await this.discoveryQueue.close();
    if (this.fetchQueue) await this.fetchQueue.close();
    if (this.connection) await this.connection.quit();
  }
}
