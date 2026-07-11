/**
 * User + account resolution for the passwordless flows.
 *
 * - `findOrCreateByGoogle` binds a verified Google identity to a `users` row via
 *   `accounts` (no password ever, Req 4.4/4.5). First success creates the user.
 * - `findOrCreateByEmail` resolves/creates a user for magic-link sign-in and
 *   marks the email verified.
 * - `findActiveById` loads the principal for the session guard, rejecting
 *   deleted accounts.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { accounts, userPreferences, users } from '@careerstack/database';
import type { AuthenticatedUser } from '../common/request-context.js';
import { DB } from '../common/di-tokens.js';

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  scopes: string[];
}

export interface ResolvedUser {
  userId: string;
  isNewUser: boolean;
}

const GOOGLE_PROVIDER = 'google';

@Injectable()
export class UserService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Load the active principal for the guard (deleted users are rejected). */
  async findActiveById(id: string): Promise<AuthenticatedUser | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row || row.status !== 'active') return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName ?? null,
      role: row.role === 'admin' ? 'admin' : 'user',
      timezone: row.timezone ?? null,
    };
  }

  /** Ensure a `user_preferences` row exists for the user (idempotent). */
  private async ensurePreferences(tx: Database, userId: string): Promise<void> {
    await tx.insert(userPreferences).values({ userId }).onConflictDoNothing();
  }

  /** Bind a verified Google identity to a user, creating both on first login. */
  async findOrCreateByGoogle(profile: GoogleProfile): Promise<ResolvedUser> {
    const email = UserService.normalizeEmail(profile.email);
    return this.db.transaction(async (tx) => {
      const [existingAccount] = await tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, GOOGLE_PROVIDER),
            eq(accounts.providerAccountId, profile.providerAccountId),
          ),
        )
        .limit(1);

      if (existingAccount) {
        await tx
          .update(accounts)
          .set({ scopes: profile.scopes, connectedAt: new Date() })
          .where(eq(accounts.id, existingAccount.id));
        return { userId: existingAccount.userId, isNewUser: false };
      }

      // Link to an existing user with the same verified email, else create one.
      const [existingUser] = await tx.select().from(users).where(eq(users.email, email)).limit(1);

      let userId: string;
      let isNewUser = false;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            displayName: profile.displayName,
            emailVerifiedAt: profile.emailVerified ? new Date() : null,
          })
          .returning({ id: users.id });
        userId = (created as { id: string }).id;
        isNewUser = true;
      }

      await tx.insert(accounts).values({
        userId,
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.providerAccountId,
        scopes: profile.scopes,
        connectedAt: new Date(),
      });
      await this.ensurePreferences(tx, userId);
      return { userId, isNewUser };
    });
  }

  /** Resolve/create a user for magic-link sign-in and mark email verified. */
  async findOrCreateByEmail(rawEmail: string): Promise<ResolvedUser> {
    const email = UserService.normalizeEmail(rawEmail);
    return this.db.transaction(async (tx) => {
      const [existingUser] = await tx.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser) {
        if (existingUser.emailVerifiedAt === null) {
          await tx
            .update(users)
            .set({ emailVerifiedAt: new Date() })
            .where(eq(users.id, existingUser.id));
        }
        return { userId: existingUser.id, isNewUser: false };
      }

      const [created] = await tx
        .insert(users)
        .values({ email, emailVerifiedAt: new Date() })
        .returning({ id: users.id });
      const userId = (created as { id: string }).id;
      await this.ensurePreferences(tx, userId);
      return { userId, isNewUser: true };
    });
  }

  /** Look up a user id by email without creating one (magic-link request). */
  async findIdByEmail(rawEmail: string): Promise<string | null> {
    const email = UserService.normalizeEmail(rawEmail);
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row?.id ?? null;
  }
}
