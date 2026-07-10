/**
 * Expiry / closure detection stage (Task 10.7, Req 38).
 *
 * Two modes:
 *  - TARGETED — a source closure signal for one opportunity: `closed` → Closed,
 *    `removed` → Removed. An ambiguous/unknown signal is NOT asserted; the
 *    opportunity is marked `Needs review` and a `closure_ambiguous` review item
 *    is recorded (Req 38.2). Closed records are retained, never deleted (Req 38.3).
 *  - SWEEP — no target: open opportunities whose `closing_at` has passed become
 *    `Expired`; those closing within the horizon become `Closing soon`.
 *
 * Content-change detection (Req 39) happens at persist time in the dedup stage,
 * where the previous and new canonical hashes are both available.
 */

import { and, eq, gte, inArray, isNotNull, lt, lte } from 'drizzle-orm';
import { schema } from '@careerstack/database';
import type { PipelineContext } from '../context.js';
import type { ExpiryCheckJobData } from '../queues.js';

const OPEN_STATUSES = ['New', 'Active', 'Closing soon'] as const;
const CLOSING_SOON_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** Apply a targeted source closure signal to one opportunity (Req 38.1/38.2). */
async function applyTargeted(
  ctx: PipelineContext,
  data: ExpiryCheckJobData,
  opportunityId: string,
): Promise<void> {
  const now = new Date();
  const signal = data.closureSignal ?? 'unknown';

  if (signal === 'closed' || signal === 'removed') {
    await ctx.db
      .update(schema.opportunities)
      .set({ status: signal === 'closed' ? 'Closed' : 'Removed', lastUpdatedAt: now })
      .where(eq(schema.opportunities.id, opportunityId));
    ctx.logger.info('expiry.closed', {
      stage: 'expiry-check',
      outcome: 'success',
      correlationId: data.correlationId,
      opportunityId,
    });
    return;
  }

  if (signal === 'unknown') {
    // Ambiguous — do NOT assert closure; surface for review (Req 38.2).
    await ctx.db
      .update(schema.opportunities)
      .set({ status: 'Needs review', lastUpdatedAt: now })
      .where(eq(schema.opportunities.id, opportunityId));
    await ctx.db.insert(schema.reviewQueueItems).values({
      kind: 'closure_ambiguous',
      ...(data.rawArtifactId !== undefined ? { rawArtifactId: data.rawArtifactId } : {}),
      reason: 'closure could not be determined with confidence',
      status: 'open',
    });
  }
  // signal === 'open' → nothing to assert.
}

/** Sweep open opportunities for expiry + closing-soon transitions. */
async function applySweep(ctx: PipelineContext, data: ExpiryCheckJobData): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + CLOSING_SOON_HORIZON_MS);

  const expired = await ctx.db
    .update(schema.opportunities)
    .set({ status: 'Expired', lastUpdatedAt: now })
    .where(
      and(
        inArray(schema.opportunities.status, [...OPEN_STATUSES]),
        isNotNull(schema.opportunities.closingAt),
        lt(schema.opportunities.closingAt, now),
      ),
    )
    .returning({ id: schema.opportunities.id });

  await ctx.db
    .update(schema.opportunities)
    .set({ status: 'Closing soon', lastUpdatedAt: now })
    .where(
      and(
        inArray(schema.opportunities.status, ['New', 'Active']),
        isNotNull(schema.opportunities.closingAt),
        gte(schema.opportunities.closingAt, now),
        lte(schema.opportunities.closingAt, soon),
      ),
    );

  ctx.logger.info('expiry.sweep', {
    stage: 'expiry-check',
    outcome: 'success',
    correlationId: data.correlationId,
    expired: expired.length,
  });
}

export async function runExpiryCheck(
  ctx: PipelineContext,
  data: ExpiryCheckJobData,
): Promise<void> {
  if (data.opportunityId) {
    await applyTargeted(ctx, data, data.opportunityId);
    return;
  }
  await applySweep(ctx, data);
}
