/**
 * Discovery stage (Task 10.4, Req 20.2, 24, 26.1).
 *
 * Runs `connector.discover(checkpoint)` for one active connection and enqueues
 * a `source-fetch` job per {@link DiscoveryRef}. Discovery only runs for
 * connections that are still `active` (the scheduler already filters, but we
 * re-check to honor a pause/remove that happened after enqueue — Req 25).
 *
 * Idempotency: each fetch job id is derived from the connection + ref dedup key
 * so re-discovery of the same posting collapses onto one job (Design Worker §9).
 */

import { eq } from 'drizzle-orm';
import { schema } from '@careerstack/database';
import { buildConnectorContext } from '../connector-context.js';
import type { PipelineContext } from '../context.js';
import type { DiscoveryJobData } from '../queues.js';
import { incrementRunCounter, openRun } from '../runs.js';

/** Load a connection row, or `null` when it is missing/removed. */
async function loadActiveConnection(ctx: PipelineContext, connectionId: string) {
  const rows = await ctx.db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, connectionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== 'active') return null; // paused/removed → do not schedule (Req 25)
  return row;
}

/** Run discovery for one connection; returns the run id used. */
export async function runDiscovery(
  ctx: PipelineContext,
  data: DiscoveryJobData,
  signal: AbortSignal,
): Promise<{ runId: string; discovered: number }> {
  const connection = await loadActiveConnection(ctx, data.connectionId);
  if (!connection) {
    ctx.logger.info('discovery.skipped', {
      stage: 'discover',
      outcome: 'skipped',
      connectionId: data.connectionId,
      correlationId: data.correlationId,
    });
    return { runId: data.runId ?? '', discovered: 0 };
  }

  const runId = data.runId ?? (await openRun(ctx.db, data.connectionId, data.correlationId));
  const connector = ctx.registry.require(connection.sourceType);

  const connectorCtx = buildConnectorContext({
    pipeline: ctx,
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    connectionConfig: connection.config as Record<string, unknown>,
    signal,
  });

  const checkpoint = (await ctx.checkpointStore.load(data.connectionId)) ?? {};

  let discovered = 0;
  for await (const ref of connector.discover(connectorCtx, checkpoint)) {
    if (signal.aborted) break; // graceful shutdown: stop discovering (Design Worker §9)
    await ctx.queues.sourceFetch.add(
      'fetch',
      {
        connectionId: data.connectionId,
        runId,
        correlationId: data.correlationId,
        sourceType: connection.sourceType,
        ref,
      },
      { jobId: `fetch:${data.connectionId}:${ref.dedupKey}` },
    );
    discovered += 1;
  }

  await incrementRunCounter(ctx.db, runId, 'itemsDiscovered', discovered);
  ctx.logger.info('discovery.completed', {
    stage: 'discover',
    outcome: 'success',
    connectionId: data.connectionId,
    correlationId: data.correlationId,
    discovered,
  });
  return { runId, discovered };
}
