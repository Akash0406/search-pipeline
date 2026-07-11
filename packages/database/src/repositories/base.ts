/**
 * Ownership-scoped repository base (PRIV-006).
 *
 * This is the canonical enforcement point behind cross-user isolation
 * (Requirements 54.1, 54.2, 54.3, 10.5, 43.4). EVERY user-scoped query goes
 * through here and is unconditionally constrained by
 * `WHERE <owner_column> = :ownerId`, so:
 *
 * - a missing owner id is impossible (it is a required argument), and
 * - a foreign owner id yields not-found / no-op (deny), never another user's
 *   rows.
 *
 * Concrete repositories (added in later tasks) extend this class, passing the
 * Drizzle table plus its id and owner columns. Because the owner predicate is
 * injected by the base — not by the caller — a subclass cannot accidentally
 * issue an unscoped read or write against a user-owned table.
 *
 * The base intentionally exposes only owner-scoped operations. If a subclass
 * needs a specialized query, it should build it from `ownerScope()` /
 * `ownerAnd()` so the owner predicate is always present.
 */
import { and, eq, type SQL, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../client.js';

export interface OwnershipScopedRepositoryConfig<TTable extends PgTable> {
  /** The user-owned Drizzle table this repository guards. */
  readonly table: TTable;
  /** The primary-key column used for single-row lookups. */
  readonly idColumn: PgColumn;
  /** The ownership column (e.g. `users.id` FK: `user_id`) — always filtered. */
  readonly ownerColumn: PgColumn;
}

export abstract class OwnershipScopedRepository<TTable extends PgTable> {
  protected readonly db: Database;
  protected readonly table: TTable;
  protected readonly idColumn: PgColumn;
  protected readonly ownerColumn: PgColumn;

  protected constructor(db: Database, config: OwnershipScopedRepositoryConfig<TTable>) {
    this.db = db;
    this.table = config.table;
    this.idColumn = config.idColumn;
    this.ownerColumn = config.ownerColumn;
  }

  /**
   * The mandatory ownership predicate: `owner_column = :ownerId`.
   * Every query in this class is built on top of this.
   */
  protected ownerScope(ownerId: string): SQL {
    // `eq` always returns a defined SQL for a column + value.
    return eq(this.ownerColumn, ownerId) as SQL;
  }

  /** Combine the ownership predicate with additional conditions (AND). */
  protected ownerAnd(ownerId: string, ...conditions: Array<SQL | undefined>): SQL {
    const combined = and(this.ownerScope(ownerId), ...conditions);
    // `and` with at least one defined arg is always defined.
    return combined as SQL;
  }

  /** List every row owned by `ownerId`. */
  async listForOwner(ownerId: string): Promise<InferSelectModel<TTable>[]> {
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(this.ownerScope(ownerId));
    return rows as InferSelectModel<TTable>[];
  }

  /**
   * Fetch a single row by id, but ONLY if owned by `ownerId`.
   * Returns `null` for a missing row or a row owned by someone else.
   */
  async findByIdForOwner(id: string, ownerId: string): Promise<InferSelectModel<TTable> | null> {
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(this.ownerAnd(ownerId, eq(this.idColumn, id)))
      .limit(1);
    return (rows[0] as InferSelectModel<TTable> | undefined) ?? null;
  }

  /**
   * Insert a row. The owner id is injected into the values so callers cannot
   * create a row owned by another user.
   */
  async createForOwner(
    ownerId: string,
    values: Omit<InferInsertModel<TTable>, never>,
  ): Promise<InferSelectModel<TTable>> {
    const toInsert = {
      ...values,
      [this.ownerColumn.name]: ownerId,
    } as InferInsertModel<TTable>;
    const rows = await this.db
      .insert(this.table as PgTable)
      .values(toInsert)
      .returning();
    return rows[0] as InferSelectModel<TTable>;
  }

  /**
   * Update a row by id, scoped to `ownerId`. A foreign / missing row updates
   * nothing and returns `null`.
   */
  async updateForOwner(
    id: string,
    ownerId: string,
    patch: Partial<InferInsertModel<TTable>>,
  ): Promise<InferSelectModel<TTable> | null> {
    const rows = await this.db
      .update(this.table as PgTable)
      .set(patch as Record<string, unknown>)
      .where(this.ownerAnd(ownerId, eq(this.idColumn, id)))
      .returning();
    return (rows[0] as InferSelectModel<TTable> | undefined) ?? null;
  }

  /**
   * Delete a row by id, scoped to `ownerId`. Returns `true` when a row owned by
   * `ownerId` was deleted, `false` otherwise (foreign/missing → no-op deny).
   */
  async deleteForOwner(id: string, ownerId: string): Promise<boolean> {
    const rows = await this.db
      .delete(this.table as PgTable)
      .where(this.ownerAnd(ownerId, eq(this.idColumn, id)))
      .returning({ id: this.idColumn });
    return rows.length > 0;
  }
}
