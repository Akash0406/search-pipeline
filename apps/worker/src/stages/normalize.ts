/**
 * Normalize stage (Task 10.6, Req 33.1, 35, 36.1).
 *
 * Runs the pure `normalize()` mapper (which also resolves the canonical/identity
 * URL). A validation failure routes to the Review_Queue with its reasons
 * (Req 33.1 / 35.3). A valid candidate is forwarded to deduplication, carrying
 * the raw description HTML (sanitized downstream) plus requirements/skills lists
 * so the dedup persist step can write the full canonical record.
 */

import { normalize } from '@careerstack/shared';
import { schema } from '@careerstack/database';
import type { PipelineContext } from '../context.js';
import type { NormalizationJobData } from '../queues.js';

/** Extract flat string lists from evidence-wrapped parsed fields. */
function evidenceValues(list?: { value: string }[]): string[] | undefined {
  if (!list || list.length === 0) return undefined;
  const values = list.map((e) => e.value.trim()).filter((v) => v.length > 0);
  return values.length > 0 ? values : undefined;
}

export async function runNormalize(
  ctx: PipelineContext,
  data: NormalizationJobData,
): Promise<{ routed: 'deduplication' | 'review' }> {
  const result = normalize(data.parsed, data.source);

  if (!result.ok) {
    const reason = result.failure.reasons.join('; ');
    await ctx.db.insert(schema.reviewQueueItems).values({
      kind: 'invalid_record',
      rawArtifactId: data.rawArtifactId,
      reason,
      status: 'open',
    });
    ctx.logger.warn('normalize.review_routed', {
      stage: 'normalize',
      outcome: 'failure',
      correlationId: data.correlationId,
      rawArtifactId: data.rawArtifactId,
      errorCode: 'SCHEMA_INVALID',
    });
    return { routed: 'review' };
  }

  const candidate = result.candidate;
  const requirements = evidenceValues(data.parsed.requirements);
  const skills = evidenceValues(data.parsed.skills);

  await ctx.queues.deduplication.add(
    'dedup',
    {
      correlationId: data.correlationId,
      connectionId: data.connectionId,
      rawArtifactId: data.rawArtifactId,
      candidate,
      ...(candidate.description !== undefined ? { descriptionHtml: candidate.description } : {}),
      ...(requirements !== undefined ? { requirements } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(candidate.postedAt !== undefined ? { postedAt: candidate.postedAt } : {}),
      ...(candidate.closureSignal !== undefined ? { closureSignal: candidate.closureSignal } : {}),
    },
    { jobId: `dedup:${candidate.key}:${candidate.fingerprint}` },
  );

  ctx.logger.info('normalize.completed', {
    stage: 'normalize',
    outcome: 'success',
    correlationId: data.correlationId,
    rawArtifactId: data.rawArtifactId,
  });
  return { routed: 'deduplication' };
}
