/**
 * Data access for `connector_runs` — the observable run history (Req 24 /
 * SRC-005).
 *
 * Runs have no `user_id` of their own; ownership is enforced through the parent
 * connection (the service verifies the connection is owned before calling
 * these methods). `openRun` records a genuine run that STARTS when the user
 * triggers it (status `running`, `started_at = now`, zero counts) — the worker
 * fills the counts/outcome as the pipeline progresses. No run data is
 * fabricated: counts stay zero until the worker reports real progress.
 */
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, type InferSelectModel } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { connectorRuns } from '@careerstack/database';
import { DB } from '../common/di-tokens.js';

export type ConnectorRunRow = InferSelectModel<typeof connectorRuns>;

@Injectable()
export class ConnectionRunRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Open a new `running` run for a connection and return its id. The run is
   * real: it reflects the run the user just triggered. The worker reuses this
   * id (via the discovery job's `runId`) to attach counts and the outcome.
   */
  async openRun(connectionId: string, correlationId: string): Promise<ConnectorRunRow> {
    const [row] = await this.db
      .insert(connectorRuns)
      .values({
        connectionId,
        correlationId,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('Failed to open connector run');
    return row;
  }

  /** List a connection's runs, newest first, paginated (limit/offset). */
  async listForConnection(
    connectionId: string,
    limit: number,
    offset: number,
  ): Promise<ConnectorRunRow[]> {
    return this.db
      .select()
      .from(connectorRuns)
      .where(eq(connectorRuns.connectionId, connectionId))
      .orderBy(desc(connectorRuns.startedAt))
      .limit(limit)
      .offset(offset);
  }

  /** Most recent run for a connection, or null when it has never run. */
  async latestForConnection(connectionId: string): Promise<ConnectorRunRow | null> {
    const rows = await this.db
      .select()
      .from(connectorRuns)
      .where(eq(connectorRuns.connectionId, connectionId))
      .orderBy(desc(connectorRuns.startedAt))
      .limit(1);
    return rows[0] ?? null;
  }
}
