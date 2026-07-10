/**
 * `CheckpointStore` backed by the `connector_checkpoints` table (Req 26.1).
 *
 * Connectors read/write checkpoints through the injected store (via
 * `ctx.config.checkpointStore`), so the pure connectors package never touches
 * the database. Checkpoints persist the pagination cursor and per-URL
 * ETag/Last-Modified validators used for conditional GETs (Req 26.3).
 */

import { eq } from 'drizzle-orm';
import type { Checkpoint } from '@careerstack/connectors';
import type { CheckpointStore } from '@careerstack/connectors';
import { type Database, schema } from '@careerstack/database';

export class DbCheckpointStore implements CheckpointStore {
  constructor(private readonly db: Database) {}

  async load(connectionId: string): Promise<Checkpoint | null> {
    const rows = await this.db
      .select()
      .from(schema.connectorCheckpoints)
      .where(eq(schema.connectorCheckpoints.connectionId, connectionId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const checkpoint: Checkpoint = {};
    if (row.cursor !== null) checkpoint.cursor = row.cursor;
    if (row.etags !== null) checkpoint.etags = row.etags as Record<string, string>;
    if (row.lastModified !== null) {
      checkpoint.lastModified = row.lastModified as Record<string, string>;
    }
    if (row.lastSuccessfulAt !== null) {
      checkpoint.lastSuccessfulAt = row.lastSuccessfulAt.toISOString();
    }
    return checkpoint;
  }

  async save(connectionId: string, checkpoint: Checkpoint): Promise<void> {
    const lastSuccessfulAt = checkpoint.lastSuccessfulAt
      ? new Date(checkpoint.lastSuccessfulAt)
      : null;
    await this.db
      .insert(schema.connectorCheckpoints)
      .values({
        connectionId,
        cursor: checkpoint.cursor ?? null,
        etags: checkpoint.etags ?? null,
        lastModified: checkpoint.lastModified ?? null,
        lastRunAt: new Date(),
        lastSuccessfulAt,
      })
      .onConflictDoUpdate({
        target: schema.connectorCheckpoints.connectionId,
        set: {
          cursor: checkpoint.cursor ?? null,
          etags: checkpoint.etags ?? null,
          lastModified: checkpoint.lastModified ?? null,
          lastRunAt: new Date(),
          lastSuccessfulAt,
        },
      });
  }
}
