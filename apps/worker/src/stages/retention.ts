/**
 * Retention-cleanup stage (Task 10.8, Req 53).
 *
 * Deletes/anonymizes Raw_Artifacts past their `retention_until` window: the
 * stored object is removed from object storage and the row is tombstoned
 * (`deleted_at` set, headers cleared) while the row itself is retained so
 * provenance links stay referentially valid. Canonical opportunities are never
 * touched and remain fully accessible after their artifacts are reclaimed
 * (Req 53.3).
 */

import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import { schema } from '@careerstack/database';
import type { PipelineContext } from '../context.js';
import type { RetentionCleanupJobData } from '../queues.js';

const DEFAULT_BATCH = 500;

export async function runRetentionCleanup(
  ctx: PipelineContext,
  data: RetentionCleanupJobData,
): Promise<{ removed: number }> {
  const now = new Date();
  const limit = data.batchSize ?? DEFAULT_BATCH;

  const due = await ctx.db
    .select({
      id: schema.rawArtifacts.id,
      storageKey: schema.rawArtifacts.storageKey,
    })
    .from(schema.rawArtifacts)
    .where(
      and(
        isNull(schema.rawArtifacts.deletedAt),
        lt(schema.rawArtifacts.retentionUntil, now),
      ),
    )
    .orderBy(asc(schema.rawArtifacts.retentionUntil))
    .limit(limit);

  let removed = 0;
  for (const artifact of due) {
    try {
      await ctx.storage.delete(artifact.storageKey);
    } catch (err) {
      // Object may already be gone; still tombstone the row so we do not retry
      // forever. Log and continue (isolation — one failure never blocks others).
      ctx.logger.warn('retention.object_delete_failed', {
        stage: 'retention-cleanup',
        outcome: 'failure',
        correlationId: data.correlationId,
        rawArtifactId: artifact.id,
        error: err,
      });
    }
    await ctx.db
      .update(schema.rawArtifacts)
      .set({ deletedAt: now, headers: null })
      .where(eq(schema.rawArtifacts.id, artifact.id));
    removed += 1;
  }

  ctx.logger.info('retention.completed', {
    stage: 'retention-cleanup',
    outcome: 'success',
    correlationId: data.correlationId,
    removed,
  });
  return { removed };
}
