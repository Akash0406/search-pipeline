/**
 * Export-job producer (Req 49.1, 49.3, RES-002).
 *
 * Enqueues a `data-export` job onto the BullMQ queue consumed by `apps/worker`,
 * which assembles the bundle asynchronously (Design Worker §9). The job id is
 * the `exportId` so retries / duplicate enqueues collapse onto ONE export
 * (at-least-once + idempotent). The queue name and payload shape are the
 * cross-process contract with the worker — kept in sync by string/interface.
 *
 * The Redis connection + queue are created LAZILY on first enqueue, so the API
 * has no Redis coupling at boot: if Redis is momentarily unavailable the failure
 * surfaces on the export request (a 5xx) rather than crashing the process.
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import type { Config } from '@careerstack/config';
import type { Logger } from '@careerstack/observability';
import { CONFIG, LOGGER } from '../common/di-tokens.js';

/** Shared queue name with the worker (`QUEUE_NAMES.dataExport`). */
export const EXPORT_QUEUE_NAME = 'data-export' as const;

/** Job payload — mirrors the worker's `ExportJobData`. */
export interface ExportJobData {
  exportId: string;
  userId: string;
  correlationId: string;
}

@Injectable()
export class ExportQueue implements OnModuleDestroy {
  private connection?: Redis;
  private queue?: Queue<ExportJobData>;
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

  /** Enqueue an export job keyed by `exportId` (idempotent, at-least-once). */
  async enqueue(data: ExportJobData): Promise<void> {
    await this.getQueue().add('export', data, {
      jobId: data.exportId,
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffBaseMs },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    });
  }

  /** Construct the connection + queue on first use (no Redis I/O at boot). */
  private getQueue(): Queue<ExportJobData> {
    if (this.queue) return this.queue;
    // BullMQ requires maxRetriesPerRequest: null on its connection.
    this.connection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    // Log (never crash on) connection errors; ioredis retries in the background.
    this.connection.on('error', (err: unknown) => {
      this.logger.warn('export.queue.redis_error', { error: err });
    });
    // ioredis is a transitive dep of bullmq; cast the client to BullMQ's
    // ConnectionOptions (the worker uses the same pattern) to avoid a spurious
    // dual-version structural mismatch under exactOptionalPropertyTypes.
    const connection = this.connection as unknown as ConnectionOptions;
    this.queue = new Queue<ExportJobData>(EXPORT_QUEUE_NAME, { connection });
    // BullMQ re-emits connection errors on the queue; handle them so an
    // unhandled 'error' event can never crash the API process.
    this.queue.on('error', (err: unknown) => {
      this.logger.warn('export.queue.error', { error: err });
    });
    return this.queue;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) await this.queue.close();
    if (this.connection) await this.connection.quit();
  }
}
