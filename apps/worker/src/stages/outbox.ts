/**
 * Outbox-dispatch relay (Task 10.8, transactional outbox).
 *
 * Polls unpublished `outbox_events` (written atomically with state changes in
 * the dedup stage) and marks them published — at-least-once emission. Event
 * consumers are future specs, so this relay currently logs the dispatch and
 * stamps `published_at`; swapping in a real broker later requires no changes to
 * the producers.
 */

import { asc, eq, isNull } from 'drizzle-orm';
import { schema } from '@careerstack/database';
import type { PipelineContext } from '../context.js';
import type { OutboxDispatchJobData } from '../queues.js';

const DEFAULT_BATCH = 200;

export async function runOutboxDispatch(
  ctx: PipelineContext,
  data: OutboxDispatchJobData,
): Promise<{ dispatched: number }> {
  const limit = data.batchSize ?? DEFAULT_BATCH;

  const pending = await ctx.db
    .select()
    .from(schema.outboxEvents)
    .where(isNull(schema.outboxEvents.publishedAt))
    .orderBy(asc(schema.outboxEvents.createdAt))
    .limit(limit);

  let dispatched = 0;
  for (const event of pending) {
    // Dispatch = log for now (future specs subscribe). At-least-once: we only
    // mark published AFTER a successful dispatch, so a crash re-delivers.
    ctx.logger.info('outbox.dispatched', {
      stage: 'outbox-dispatch',
      outcome: 'success',
      correlationId: event.correlationId ?? data.correlationId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    });
    await ctx.db
      .update(schema.outboxEvents)
      .set({ publishedAt: new Date() })
      .where(eq(schema.outboxEvents.id, event.id));
    dispatched += 1;
  }

  return { dispatched };
}
