/**
 * Dead-letter queues + connector-error isolation (Task 10.9, Req 20.4, 55, 27.3).
 *
 * BullMQ already isolates job failures from the worker process and from other
 * jobs, so one connector throwing never stops the others (Req 55.1/55.2). This
 * module adds the two remaining guarantees:
 *  - a per-queue DLQ receives a job once its retries are exhausted, preserving
 *    the payload + failure reason for admin inspection (Req 27.3);
 *  - stage failures are recorded against the owning `connection`/`connector_run`
 *    without crashing anything (Req 20.4, 24.3), best-effort so the recorder can
 *    never itself take the worker down.
 */

import { Queue, type ConnectionOptions, type Job } from 'bullmq';
import type { Database } from '@careerstack/database';
import type { Logger } from '@careerstack/observability';
import { recordConnectionFailure } from './runs.js';
import { ALL_QUEUE_NAMES, dlqNameFor, type QueueName } from './queues.js';

/** Payload stored on a dead-lettered job. */
export interface DeadLetterPayload {
  originalQueue: QueueName;
  originalJobId?: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  deadLetteredAt: string;
}

/** Owns one DLQ per pipeline queue. */
export class DeadLetterQueues {
  private readonly byQueue = new Map<QueueName, Queue<DeadLetterPayload>>();

  constructor(connection: ConnectionOptions) {
    for (const name of ALL_QUEUE_NAMES) {
      this.byQueue.set(
        name,
        new Queue<DeadLetterPayload>(dlqNameFor(name), { connection }),
      );
    }
  }

  /** Move an exhausted job into its queue's DLQ. */
  async deadLetter(queue: QueueName, job: Job, failedReason: string): Promise<void> {
    const dlq = this.byQueue.get(queue);
    if (!dlq) return;
    const payload: DeadLetterPayload = {
      originalQueue: queue,
      jobName: job.name,
      data: job.data,
      failedReason,
      attemptsMade: job.attemptsMade,
      deadLetteredAt: new Date().toISOString(),
      ...(job.id !== undefined ? { originalJobId: job.id } : {}),
    };
    await dlq.add('dead-letter', payload, { removeOnComplete: false });
  }

  async close(): Promise<void> {
    await Promise.all([...this.byQueue.values()].map((q) => q.close()));
  }
}

/** True when a job has consumed all of its configured attempts. */
export function isExhausted(job: Job): boolean {
  const attempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= attempts;
}

/**
 * Best-effort: record a stage failure against the connection/run if the job
 * payload identifies one. Never throws (isolation — Req 20.4/55).
 */
export async function recordStageFailure(
  db: Database,
  logger: Logger,
  data: unknown,
  reason: string,
): Promise<void> {
  try {
    if (data && typeof data === 'object' && 'connectionId' in data) {
      const d = data as { connectionId?: unknown; runId?: unknown };
      if (typeof d.connectionId === 'string' && d.connectionId.length > 0) {
        await recordConnectionFailure(db, {
          connectionId: d.connectionId,
          reason,
          ...(typeof d.runId === 'string' ? { runId: d.runId } : {}),
        });
      }
    }
  } catch (err) {
    logger.error('dlq.record_failure_failed', {
      stage: 'dlq',
      outcome: 'failure',
      error: err,
    });
  }
}
