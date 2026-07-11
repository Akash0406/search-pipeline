/**
 * Ownership-scoped data access for connections, used by the disconnect flow
 * (Req 51, 54.3).
 *
 * Extends {@link OwnershipScopedRepository} so a connection is only reachable by
 * its owner (`WHERE connections.user_id = :ownerId`); a foreign/missing id
 * yields not-found (deny).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { OwnershipScopedRepository, connections } from '@careerstack/database';
import { DB } from '../common/di-tokens.js';

export type ConnectionRow = InferSelectModel<typeof connections>;

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
}
