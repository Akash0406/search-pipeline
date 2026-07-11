/**
 * Fetch stage (Task 10.4, Req 26.2/26.3, 27, 32).
 *
 * Fetches one discovered reference via the connector (which reaches the network
 * only through the injected SafeFetcher — SSRF + bounds + per-domain rate limit
 * + conditional GET). Then:
 *  - 304 Not Modified → short-circuit: refresh the checkpoint timestamp and do
 *    NOT re-store or re-parse (Req 26.3).
 *  - 200 → store the Raw_Artifact body in object storage BEFORE parsing and
 *    insert a `raw_artifacts` row honoring UNIQUE(connection_id, source_url,
 *    content_hash) for fetch idempotency (Req 32.1/32.2). Advance the checkpoint
 *    ETag/Last-Modified and enqueue `artifact-parse`.
 *
 * When the fetched content hash matches an existing artifact, the fetch is a
 * no-op replay: we reuse the stored artifact id and skip re-parsing.
 */

import { and, eq } from 'drizzle-orm';
import type { Checkpoint, FetchResult } from '@careerstack/connectors';
import { schema } from '@careerstack/database';
import { buildConnectorContext } from '../connector-context.js';
import type { PipelineContext } from '../context.js';
import type { FetchJobData } from '../queues.js';
import { incrementRunCounter } from '../runs.js';

/** Compute the retention deadline for a freshly stored artifact (Req 53.1). */
function retentionUntil(retentionDays: number, now: Date): Date {
  return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

/** Merge the fresh validators for a URL into the connection checkpoint. */
function advanceCheckpoint(checkpoint: Checkpoint, url: string, result: FetchResult): Checkpoint {
  const etags = { ...(checkpoint.etags ?? {}) };
  const lastModified = { ...(checkpoint.lastModified ?? {}) };
  if (result.etag) etags[url] = result.etag;
  if (result.lastModified) lastModified[url] = result.lastModified;
  return {
    ...checkpoint,
    etags,
    lastModified,
    lastSuccessfulAt: new Date().toISOString(),
  };
}

export async function runFetch(
  ctx: PipelineContext,
  data: FetchJobData,
  signal: AbortSignal,
): Promise<{ notModified: boolean; rawArtifactId?: string }> {
  const connector = ctx.registry.require(data.sourceType);
  const rows = await ctx.db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, data.connectionId))
    .limit(1);
  const connection = rows[0];
  if (!connection || connection.status !== 'active') {
    ctx.logger.info('fetch.skipped', {
      stage: 'fetch',
      outcome: 'skipped',
      connectionId: data.connectionId,
      correlationId: data.correlationId,
    });
    return { notModified: false };
  }

  const connectorCtx = buildConnectorContext({
    pipeline: ctx,
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    connectionConfig: connection.config as Record<string, unknown>,
    signal,
  });

  const checkpoint = (await ctx.checkpointStore.load(data.connectionId)) ?? {};
  const result = await connector.fetch(connectorCtx, data.ref, checkpoint);
  await incrementRunCounter(ctx.db, data.runId, 'itemsFetched');

  // 304 short-circuit — no re-store / re-parse (Req 26.3).
  if (result.notModified) {
    await ctx.checkpointStore.save(
      data.connectionId,
      advanceCheckpoint(checkpoint, data.ref.url, result),
    );
    ctx.logger.info('fetch.not_modified', {
      stage: 'fetch',
      outcome: 'skipped',
      connectionId: data.connectionId,
      correlationId: data.correlationId,
      sourceUrl: data.ref.url,
    });
    return { notModified: true };
  }

  const contentHash = ctx.storage.contentHash(result.body);

  // Fetch idempotency: an identical body already stored for this source URL is
  // a replay — reuse it and skip re-parsing (Req 32.1/32.2, UNIQUE constraint).
  const existing = await ctx.db
    .select({ id: schema.rawArtifacts.id })
    .from(schema.rawArtifacts)
    .where(
      and(
        eq(schema.rawArtifacts.connectionId, data.connectionId),
        eq(schema.rawArtifacts.sourceUrl, result.finalUrl),
        eq(schema.rawArtifacts.contentHash, contentHash),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await ctx.checkpointStore.save(
      data.connectionId,
      advanceCheckpoint(checkpoint, data.ref.url, result),
    );
    ctx.logger.info('fetch.unchanged', {
      stage: 'fetch',
      outcome: 'skipped',
      connectionId: data.connectionId,
      correlationId: data.correlationId,
      rawArtifactId: existing[0].id,
    });
    return { notModified: false, rawArtifactId: existing[0].id };
  }

  // Store the Raw_Artifact body BEFORE parsing (Req 32.1).
  const stored = await ctx.storage.put({
    connectionId: data.connectionId,
    sourceUrl: result.finalUrl,
    body: result.body,
    contentType: result.contentType,
  });

  const now = new Date();
  const [inserted] = await ctx.db
    .insert(schema.rawArtifacts)
    .values({
      connectionId: data.connectionId,
      sourceType: data.sourceType,
      sourceUrl: result.finalUrl,
      fetchedAt: now,
      httpStatus: result.status,
      contentType: result.contentType,
      headers: result.headers,
      storageKey: stored.storageKey,
      contentHash,
      byteSize: stored.byteSize,
      ...(result.etag !== undefined ? { etag: result.etag } : {}),
      ...(result.lastModified !== undefined ? { lastModified: result.lastModified } : {}),
      retentionUntil: retentionUntil(ctx.config.retention.rawRetentionDays, now),
      correlationId: data.correlationId,
    })
    .onConflictDoNothing({
      target: [
        schema.rawArtifacts.connectionId,
        schema.rawArtifacts.sourceUrl,
        schema.rawArtifacts.contentHash,
      ],
    })
    .returning({ id: schema.rawArtifacts.id });

  // A concurrent writer may have won the race; resolve the id either way.
  let rawArtifactId = inserted?.id;
  if (!rawArtifactId) {
    const race = await ctx.db
      .select({ id: schema.rawArtifacts.id })
      .from(schema.rawArtifacts)
      .where(
        and(
          eq(schema.rawArtifacts.connectionId, data.connectionId),
          eq(schema.rawArtifacts.sourceUrl, result.finalUrl),
          eq(schema.rawArtifacts.contentHash, contentHash),
        ),
      )
      .limit(1);
    rawArtifactId = race[0]?.id;
  }
  if (!rawArtifactId) throw new Error('Failed to persist raw artifact');

  await ctx.checkpointStore.save(
    data.connectionId,
    advanceCheckpoint(checkpoint, data.ref.url, result),
  );

  await ctx.queues.artifactParse.add(
    'parse',
    {
      connectionId: data.connectionId,
      runId: data.runId,
      correlationId: data.correlationId,
      sourceType: data.sourceType,
      rawArtifactId,
      sourceUrl: result.finalUrl,
      externalId: data.ref.externalId,
      isFirstParty: connector.isFirstParty,
      ...(data.ref.hints !== undefined ? { hints: data.ref.hints } : {}),
    },
    { jobId: `parse:${rawArtifactId}` },
  );

  ctx.logger.info('fetch.stored', {
    stage: 'fetch',
    outcome: 'success',
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    rawArtifactId,
    byteSize: stored.byteSize,
  });
  return { notModified: false, rawArtifactId };
}
