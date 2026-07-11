/**
 * Ownership-scoped data access for connections (Req 20, 24, 25, 51, 54).
 *
 * Extends {@link OwnershipScopedRepository} so a connection is only reachable by
 * its owner (`WHERE connections.user_id = :ownerId`); a foreign/missing id
 * yields not-found (deny, PRIV-006 / Req 54).
 *
 * Mutations (create / pause-resume / remove) are all owner-scoped: the WHERE
 * clause always pins `user_id`, so a caller can never change a row they do not
 * own. `ensureConnector` upserts the static connector-registry row for a source
 * type so a new connection always has a valid `connector_id` FK even when the
 * `connectors` table has not been separately seeded.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, type InferSelectModel } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { OwnershipScopedRepository, connections, connectors } from '@careerstack/database';
import type { SourceType } from '@careerstack/connectors';
import { DB } from '../common/di-tokens.js';

export type ConnectionRow = InferSelectModel<typeof connections>;

/** Fields needed to create a connection (already validated by the service). */
export interface CreateConnectionInput {
  userId: string;
  sourceType: SourceType;
  config: Record<string, unknown>;
  displayName: string;
  isFirstParty: boolean;
}

@Injectable()
export class ConnectionRepository extends OwnershipScopedRepository<typeof connections> {
  constructor(@Inject(DB) db: Database) {
    super(db, {
      table: connections,
      idColumn: connections.id,
      ownerColumn: connections.userId,
    });
  }

  /** Fetch an owned connection by id, or null (foreign/missing → deny). */
  async findOwned(id: string, userId: string): Promise<ConnectionRow | null> {
    return this.findByIdForOwner(id, userId) as Promise<ConnectionRow | null>;
  }

  /** List the caller's connections, newest first (ownership-scoped, Req 54.3). */
  async listOwned(userId: string): Promise<ConnectionRow[]> {
    return this.listForOwner(userId) as Promise<ConnectionRow[]>;
  }

  /**
   * Find the first owned, non-removed connection for a source type + config
   * predicate — used to reuse an existing `manual_url` connection for the same
   * URL rather than piling up duplicates (Req 23 / SRC-004).
   */
  async findOwnedBySourceAndConfigKey(
    userId: string,
    sourceType: SourceType,
    configKey: string,
    configValue: string,
  ): Promise<ConnectionRow | null> {
    const rows = await this.db
      .select()
      .from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.sourceType, sourceType)));
    const match = rows.find(
      (r) =>
        r.status !== 'removed' && (r.config as Record<string, unknown>)[configKey] === configValue,
    );
    return match ?? null;
  }

  /**
   * Upsert the static `connectors` registry row for a source type and return
   * its id, so a created connection always has a valid `connector_id` FK.
   */
  async ensureConnector(
    sourceType: SourceType,
    displayName: string,
    isFirstParty: boolean,
  ): Promise<string> {
    const existing = await this.db
      .select({ id: connectors.id })
      .from(connectors)
      .where(eq(connectors.sourceType, sourceType))
      .limit(1);
    if (existing[0]) return existing[0].id;

    const [inserted] = await this.db
      .insert(connectors)
      .values({ sourceType, displayName, isFirstParty })
      .onConflictDoNothing({ target: connectors.sourceType })
      .returning({ id: connectors.id });
    if (inserted) return inserted.id;

    // Lost an insert race — read the row the other writer created.
    const row = await this.db
      .select({ id: connectors.id })
      .from(connectors)
      .where(eq(connectors.sourceType, sourceType))
      .limit(1);
    if (!row[0]) throw new Error(`Failed to resolve connector for source type "${sourceType}"`);
    return row[0].id;
  }

  /** Insert a new active connection owned by the caller and return the row. */
  async create(input: CreateConnectionInput): Promise<ConnectionRow> {
    const connectorId = await this.ensureConnector(
      input.sourceType,
      input.displayName,
      input.isFirstParty,
    );
    const [row] = await this.db
      .insert(connections)
      .values({
        userId: input.userId,
        connectorId,
        sourceType: input.sourceType,
        config: input.config,
        status: 'active',
        healthStatus: 'unknown',
        consecutiveFailures: 0,
      })
      .returning();
    if (!row) throw new Error('Failed to create connection');
    return row;
  }

  /**
   * Set an owned connection's status (active|paused) and optionally its config.
   * Returns the updated row, or null when the id is not owned (deny, Req 54).
   */
  async updateOwned(
    id: string,
    userId: string,
    patch: { status?: 'active' | 'paused'; config?: Record<string, unknown> },
  ): Promise<ConnectionRow | null> {
    const [row] = await this.db
      .update(connections)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.config !== undefined ? { config: patch.config } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .returning();
    return row ?? null;
  }

  /**
   * Mark an owned connection `removed` (soft delete): scheduling stops (only
   * `active` connections are scheduled) and previously ingested opportunities
   * are retained untouched (Req 25.3). Returns true when a row was removed.
   */
  async markRemoved(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .update(connections)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .returning({ id: connections.id });
    return rows.length > 0;
  }
}
