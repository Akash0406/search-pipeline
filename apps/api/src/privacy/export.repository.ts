/**
 * Ownership-scoped data access for data exports (Req 49, 54.3).
 *
 * Extends {@link OwnershipScopedRepository} so every export read is constrained
 * by `WHERE exports.user_id = :ownerId` (PRIV-006): a foreign or missing id
 * yields not-found, so an export — and the signed URL derived from it — is only
 * ever reachable by its owner (Req 49.2).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { OwnershipScopedRepository, exports as exportsTable } from '@careerstack/database';
import { DB } from '../common/di-tokens.js';

export type ExportRow = InferSelectModel<typeof exportsTable>;

@Injectable()
export class ExportRepository extends OwnershipScopedRepository<typeof exportsTable> {
  constructor(@Inject(DB) db: Database) {
    super(db, {
      table: exportsTable,
      idColumn: exportsTable.id,
      ownerColumn: exportsTable.userId,
    });
  }

  /** Create a new `pending` export owned by the user and return its row. */
  async createPending(userId: string): Promise<ExportRow> {
    const [row] = await this.db
      .insert(exportsTable)
      .values({ userId, status: 'pending' })
      .returning();
    if (!row) throw new Error('Failed to create export');
    return row as ExportRow;
  }

  /** Fetch an owned export by id, or null (foreign/missing → deny). */
  async findOwned(id: string, userId: string): Promise<ExportRow | null> {
    return this.findByIdForOwner(id, userId) as Promise<ExportRow | null>;
  }
}
