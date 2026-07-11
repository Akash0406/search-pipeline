/**
 * `connector_runs` lifecycle + connection-health helpers (Req 24, 55).
 *
 * A run row is opened when discovery starts and carries running counts through
 * the pipeline. Stage failures are recorded against the run's `failure_reason`
 * WITHOUT crashing the worker (Req 20.4, 24.3, 55) and bump the connection's
 * consecutive-failure counter / health status for the admin view.
 */

import { eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { type Database, schema } from '@careerstack/database';

/** Columns on `connector_runs` that hold incrementable counters. */
export type RunCounter =
  'itemsDiscovered' | 'itemsFetched' | 'itemsParsed' | 'itemsPersisted' | 'itemsFailed';

const RUN_COLUMN: Record<RunCounter, AnyPgColumn> = {
  itemsDiscovered: schema.connectorRuns.itemsDiscovered,
  itemsFetched: schema.connectorRuns.itemsFetched,
  itemsParsed: schema.connectorRuns.itemsParsed,
  itemsPersisted: schema.connectorRuns.itemsPersisted,
  itemsFailed: schema.connectorRuns.itemsFailed,
};

/** Open a new `running` connector run and return its id. */
export async function openRun(
  db: Database,
  connectionId: string,
  correlationId: string,
): Promise<string> {
  const [row] = await db
    .insert(schema.connectorRuns)
    .values({
      connectionId,
      correlationId,
      status: 'running',
      startedAt: new Date(),
    })
    .returning({ id: schema.connectorRuns.id });
  if (!row) throw new Error('Failed to open connector run');
  return row.id;
}

/** Atomically increment a run counter by `by` (default 1). */
export async function incrementRunCounter(
  db: Database,
  runId: string,
  counter: RunCounter,
  by = 1,
): Promise<void> {
  const column = RUN_COLUMN[counter];
  await db
    .update(schema.connectorRuns)
    .set({ [counter]: sql`coalesce(${column}, 0) + ${by}` })
    .where(eq(schema.connectorRuns.id, runId));
}

/** Mark a run succeeded/failed and stamp the finish time. */
export async function finishRun(
  db: Database,
  runId: string,
  status: 'succeeded' | 'failed',
  failureReason?: string,
): Promise<void> {
  await db
    .update(schema.connectorRuns)
    .set({
      status,
      finishedAt: new Date(),
      ...(failureReason !== undefined ? { failureReason } : {}),
    })
    .where(eq(schema.connectorRuns.id, runId));
}

/**
 * Record a stage failure against the run and degrade the connection's health
 * without terminating the worker (Req 20.4, 24.3, 55). One connector failing
 * never affects others — this only touches the failing connection's rows.
 */
export async function recordConnectionFailure(
  db: Database,
  input: { connectionId: string; runId?: string; reason: string },
): Promise<void> {
  if (input.runId) {
    await db
      .update(schema.connectorRuns)
      .set({ failureReason: input.reason })
      .where(eq(schema.connectorRuns.id, input.runId));
    await incrementRunCounter(db, input.runId, 'itemsFailed');
  }
  await db
    .update(schema.connections)
    .set({
      consecutiveFailures: sql`coalesce(${schema.connections.consecutiveFailures}, 0) + 1`,
      healthStatus: 'failing',
      lastHealthReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(schema.connections.id, input.connectionId));
}

/** Mark a connection healthy after a fully successful run. */
export async function recordConnectionHealthy(db: Database, connectionId: string): Promise<void> {
  await db
    .update(schema.connections)
    .set({
      consecutiveFailures: 0,
      healthStatus: 'healthy',
      lastHealthReason: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.connections.id, connectionId));
}
