/**
 * Account deletion (Req 7, 50.1, PRIV-002).
 *
 * On confirmation the service, in a single transaction:
 *  1. writes an `account_deleted` audit event (before removal, so it stays
 *     attributable to the account — Req 7.4/9.3),
 *  2. invalidates ALL of the user's sessions (Req 7.3),
 *  3. deletes the user's personal data: role profiles (+children via cascade),
 *     saved/dismissed states, connections, OAuth accounts, magic-link tokens,
 *     exports, and preferences (Req 7.2), and
 *  4. irreversibly anonymizes the `users` row (email replaced, name/timezone
 *     cleared, status → deleted) so audit attribution survives while personal
 *     data does not.
 *
 * Previously-ingested Canonical_Opportunities remain accessible (Req 51.3/53.3)
 * because they are not user-owned; raw-artifact links use ON DELETE SET NULL.
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import {
  accounts,
  connections,
  exports as exportsTable,
  magicLinkTokens,
  opportunityUserState,
  roleProfiles,
  sessions,
  userPreferences,
  users,
} from '@careerstack/database';
import { DB } from '../common/di-tokens.js';
import { AuditService } from '../auth/audit.service.js';

export interface DeletionContext {
  ipHash?: string | null;
}

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async deleteAccount(userId: string, ctx: DeletionContext = {}): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      // 1. Audit first, while the account still exists (Req 7.4/9.3).
      await this.audit.recordTx(tx, {
        eventType: 'account_deleted',
        userId,
        actor: 'user',
        outcome: 'success',
        ipHash: ctx.ipHash ?? null,
      });

      // 2. Invalidate every session (Req 7.3), then remove them.
      await tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, userId));

      // 3. Delete personal data. Detach the active-profile pointer first so the
      //    role-profile delete is unobstructed.
      await tx
        .update(userPreferences)
        .set({ activeRoleProfileId: null })
        .where(eq(userPreferences.userId, userId));
      await tx.delete(opportunityUserState).where(eq(opportunityUserState.userId, userId));
      await tx.delete(connections).where(eq(connections.userId, userId));
      await tx.delete(roleProfiles).where(eq(roleProfiles.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));
      await tx.delete(magicLinkTokens).where(eq(magicLinkTokens.userId, userId));
      await tx.delete(exportsTable).where(eq(exportsTable.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));

      // 4. Irreversibly anonymize the user row (Req 7.2).
      await tx
        .update(users)
        .set({
          email: `deleted+${userId}@deleted.invalid`,
          displayName: null,
          timezone: null,
          emailVerifiedAt: null,
          status: 'deleted',
          anonymizedAt: now,
          deletedAt: now,
        })
        .where(eq(users.id, userId));
    });
  }
}
