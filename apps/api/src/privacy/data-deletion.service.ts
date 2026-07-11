/**
 * Partial data deletion (Req 50.2, PRIV-002).
 *
 * Deletes SPECIFIED categories of the user's own data WITHOUT full account
 * deletion (the account, its identity, and other categories stay intact). The
 * controller enforces the explicit confirmation gate; this service performs the
 * scoped deletes in a single transaction. Every delete is constrained by
 * `user_id = :userId`, so only the requesting user's rows are ever removed
 * (PRIV-006). Previously ingested Canonical_Opportunities are never touched and
 * remain accessible (Req 51.3 / 53.3).
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import {
  connections,
  opportunityUserState,
  roleProfiles,
  sessions,
  userPreferences,
} from '@careerstack/database';
import type { DeleteDataCategory } from '@careerstack/contracts';
import { DB } from '../common/di-tokens.js';

@Injectable()
export class DataDeletionService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Delete the requested owned-data categories in one transaction (Req 50.2). */
  async deleteCategories(userId: string, categories: DeleteDataCategory[]): Promise<void> {
    const unique = [...new Set(categories)];
    await this.db.transaction(async (tx) => {
      for (const category of unique) {
        switch (category) {
          case 'role_profiles':
            // Detach the active pointer first so the delete is unobstructed.
            await tx
              .update(userPreferences)
              .set({ activeRoleProfileId: null })
              .where(eq(userPreferences.userId, userId));
            // Children (titles/skills/locations/preferences) cascade.
            await tx.delete(roleProfiles).where(eq(roleProfiles.userId, userId));
            break;
          case 'saved_dismissed':
            await tx
              .delete(opportunityUserState)
              .where(eq(opportunityUserState.userId, userId));
            break;
          case 'connections':
            await tx.delete(connections).where(eq(connections.userId, userId));
            break;
          case 'sessions':
            await tx.delete(sessions).where(eq(sessions.userId, userId));
            break;
        }
      }
    });
  }
}
