/**
 * Parse stage (Task 10.5, Req 35, 48.1).
 *
 * Loads the stored Raw_Artifact, reconstructs a transport {@link FetchResult}
 * from the persisted body + headers, and runs `connector.parse`. A `parser_runs`
 * row records every attempt. If parsing throws or yields an empty/unusable
 * record, the artifact is RETAINED and a `review_queue_items` row (kind
 * `invalid_record`) captures the reason (Req 35.1–35.3). Otherwise the parsed
 * opportunity + its source metadata are enqueued for normalization.
 */

import { eq } from 'drizzle-orm';
import {
  errorMessage,
  isParsedOpportunityEmpty,
  type FetchResult,
  type ParsedOpportunity,
} from '@careerstack/connectors';
import { schema } from '@careerstack/database';
import type { SourceMeta } from '@careerstack/shared';
import { buildConnectorContext } from '../connector-context.js';
import type { PipelineContext } from '../context.js';
import type { ParseJobData } from '../queues.js';
import { incrementRunCounter } from '../runs.js';

/** Rebuild a transport FetchResult from a stored artifact + its body. */
function toFetchResult(
  row: typeof schema.rawArtifacts.$inferSelect,
  body: Buffer,
): FetchResult {
  return {
    finalUrl: row.sourceUrl,
    status: row.httpStatus ?? 200,
    notModified: false,
    headers: (row.headers as Record<string, string> | null) ?? {},
    contentType: row.contentType ?? 'application/octet-stream',
    body,
    byteSize: body.byteLength,
    ...(row.etag !== null ? { etag: row.etag } : {}),
    ...(row.lastModified !== null ? { lastModified: row.lastModified } : {}),
  };
}

/** Route an unusable record to the Review_Queue while retaining the artifact. */
async function routeToReview(
  ctx: PipelineContext,
  data: ParseJobData,
  reason: string,
): Promise<void> {
  await ctx.db.insert(schema.parserRuns).values({
    rawArtifactId: data.rawArtifactId,
    correlationId: data.correlationId,
    status: 'validation_failed',
    failureReason: reason,
  });
  await ctx.db.insert(schema.reviewQueueItems).values({
    kind: 'invalid_record',
    rawArtifactId: data.rawArtifactId,
    reason,
    status: 'open',
  });
  await incrementRunCounter(ctx.db, data.runId, 'itemsFailed');
  ctx.logger.warn('parse.review_routed', {
    stage: 'parse',
    outcome: 'failure',
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    rawArtifactId: data.rawArtifactId,
    errorCode: 'INVALID_RECORD',
  });
}

/** Build the identity/provenance {@link SourceMeta} for the parsed record. */
function buildSourceMeta(data: ParseJobData): SourceMeta {
  const meta: SourceMeta = {
    sourceType: data.sourceType,
    externalId: data.externalId,
    sourceUrl: data.sourceUrl,
    isFirstParty: data.isFirstParty,
    rawArtifactId: data.rawArtifactId,
    sourceRefId: `${data.sourceType}:${data.externalId}`,
  };
  const board = data.hints?.['board'] ?? data.hints?.['slug'];
  if (board) {
    meta.atsBoard = board;
    meta.atsPostingId = data.externalId;
  }
  const updatedAt = data.hints?.['updated_at'] ?? data.hints?.['updatedAt'];
  if (updatedAt) meta.updatedAt = updatedAt;
  return meta;
}

export async function runParse(
  ctx: PipelineContext,
  data: ParseJobData,
  signal: AbortSignal,
): Promise<{ routed: 'normalization' | 'review' }> {
  const rows = await ctx.db
    .select()
    .from(schema.rawArtifacts)
    .where(eq(schema.rawArtifacts.id, data.rawArtifactId))
    .limit(1);
  const artifact = rows[0];
  if (!artifact) throw new Error(`Raw artifact ${data.rawArtifactId} not found`);
  if (artifact.deletedAt !== null) {
    // Body already reclaimed by retention; nothing to parse.
    ctx.logger.info('parse.skipped_retained', {
      stage: 'parse',
      outcome: 'skipped',
      rawArtifactId: data.rawArtifactId,
      correlationId: data.correlationId,
    });
    return { routed: 'review' };
  }

  const body = await ctx.storage.get(artifact.storageKey);
  const connector = ctx.registry.require(data.sourceType);
  const connectorCtx = buildConnectorContext({
    pipeline: ctx,
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    connectionConfig: {},
    signal,
    rawArtifactId: data.rawArtifactId,
  });

  let parsed: ParsedOpportunity;
  try {
    parsed = await connector.parse(connectorCtx, toFetchResult(artifact, body));
  } catch (err) {
    await ctx.db.insert(schema.parserRuns).values({
      rawArtifactId: data.rawArtifactId,
      correlationId: data.correlationId,
      status: 'parse_failed',
      failureReason: errorMessage(err),
    });
    await routeToReview(ctx, data, `parse failed: ${errorMessage(err)}`);
    return { routed: 'review' };
  }

  if (isParsedOpportunityEmpty(parsed)) {
    await routeToReview(ctx, data, 'parsed record has neither title nor description');
    return { routed: 'review' };
  }

  await ctx.db.insert(schema.parserRuns).values({
    rawArtifactId: data.rawArtifactId,
    correlationId: data.correlationId,
    status: 'succeeded',
  });
  await incrementRunCounter(ctx.db, data.runId, 'itemsParsed');

  await ctx.queues.normalization.add(
    'normalize',
    {
      correlationId: data.correlationId,
      connectionId: data.connectionId,
      rawArtifactId: data.rawArtifactId,
      source: buildSourceMeta(data),
      parsed,
    },
    { jobId: `normalize:${data.rawArtifactId}` },
  );
  return { routed: 'normalization' };
}
