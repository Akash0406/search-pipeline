/**
 * Scheduler (Task 10.3, Req 25).
 *
 * Periodically enqueues `connector-discovery` jobs for ACTIVE, non-paused
 * connections only (paused/removed connections are never scheduled — Req 25),
 * and drives the periodic maintenance jobs (outbox relay, expiry sweep,
 * retention cleanup). In production this cadence is owned by EventBridge; the
 * local/worker implementation uses interval timers with time-bucketed job ids
 * so overlapping ticks collapse onto one job per window.
 *
 * All timers are `unref()`-ed so they never hold the process open during a
 * graceful shutdown.
 */

import { eq } from 'drizzle-orm';
import { generateCorrelationId } from '@careerstack/observability';
import { schema } from '@careerstack/database';
import type { PipelineContext } from './context.js';

/** Tunable scheduler cadences (ms). */
export interface SchedulerIntervals {
  discoveryMs: number;
  outboxMs: number;
  expiryMs: number;
  retentionMs: number;
}

/** Conservative defaults suitable for local development. */
export const DEFAULT_SCHEDULER_INTERVALS: SchedulerIntervals = {
  discoveryMs: 5 * 60 * 1000,
  outboxMs: 10 * 1000,
  expiryMs: 60 * 60 * 1000,
  retentionMs: 60 * 60 * 1000,
};

export class Scheduler {
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly ctx: PipelineContext,
    private readonly intervals: SchedulerIntervals = DEFAULT_SCHEDULER_INTERVALS,
  ) {}

  /** Begin scheduling. Runs an immediate discovery pass, then on interval. */
  start(): void {
    void this.enqueueDiscovery();
    this.addTimer(() => void this.enqueueDiscovery(), this.intervals.discoveryMs);
    this.addTimer(() => void this.enqueueOutbox(), this.intervals.outboxMs);
    this.addTimer(() => void this.enqueueExpirySweep(), this.intervals.expiryMs);
    this.addTimer(() => void this.enqueueRetention(), this.intervals.retentionMs);
  }

  /** Stop all timers (graceful shutdown). */
  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  private addTimer(fn: () => void, everyMs: number): void {
    const timer = setInterval(fn, everyMs);
    timer.unref?.();
    this.timers.push(timer);
  }

  /** Enqueue discovery for every active connection (Req 25). */
  private async enqueueDiscovery(): Promise<void> {
    try {
      const active = await this.ctx.db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(eq(schema.connections.status, 'active'));
      const bucket = Math.floor(Date.now() / this.intervals.discoveryMs);
      for (const connection of active) {
        await this.ctx.queues.connectorDiscovery.add(
          'discover',
          { connectionId: connection.id, correlationId: generateCorrelationId() },
          { jobId: `discovery:${connection.id}:${bucket}`.replace(/:/g, '_') },
        );
      }
      this.ctx.logger.info('scheduler.discovery_enqueued', {
        stage: 'scheduler',
        outcome: 'success',
        count: active.length,
      });
    } catch (err) {
      this.ctx.logger.error('scheduler.discovery_failed', {
        stage: 'scheduler',
        outcome: 'failure',
        error: err,
      });
    }
  }

  private async enqueueOutbox(): Promise<void> {
    await this.safeAdd('outbox', () =>
      this.ctx.queues.outboxDispatch.add(
        'dispatch',
        { correlationId: generateCorrelationId() },
        { jobId: `outbox:${Math.floor(Date.now() / this.intervals.outboxMs)}`.replace(/:/g, '_') },
      ),
    );
  }

  private async enqueueExpirySweep(): Promise<void> {
    await this.safeAdd('expiry', () =>
      this.ctx.queues.expiryCheck.add(
        'sweep',
        { correlationId: generateCorrelationId() },
        {
          jobId: `expiry-sweep:${Math.floor(Date.now() / this.intervals.expiryMs)}`.replace(
            /:/g,
            '_',
          ),
        },
      ),
    );
  }

  private async enqueueRetention(): Promise<void> {
    await this.safeAdd('retention', () =>
      this.ctx.queues.retentionCleanup.add(
        'cleanup',
        { correlationId: generateCorrelationId() },
        {
          jobId: `retention:${Math.floor(Date.now() / this.intervals.retentionMs)}`.replace(
            /:/g,
            '_',
          ),
        },
      ),
    );
  }

  private async safeAdd(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.ctx.logger.error('scheduler.enqueue_failed', {
        stage: 'scheduler',
        outcome: 'failure',
        error: err,
        label,
      });
    }
  }
}
