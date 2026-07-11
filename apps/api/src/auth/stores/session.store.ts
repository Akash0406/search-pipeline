/**
 * Drizzle-backed {@link SessionStore} over the `sessions` table.
 *
 * Every user-targeted operation is constrained by `user_id`, keeping session
 * access owner-scoped (PRIV-006 / Req 54). Revocation is a soft-delete
 * (`revoked_at`) and always filters `revoked_at IS NULL` so counts reflect only
 * sessions this call actually changed.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { sessions } from '@careerstack/database';
import type { CreateSessionInput, SessionStore, StoredSession } from '@careerstack/auth';
import { DB } from '../../common/di-tokens.js';

@Injectable()
export class DrizzleSessionStore implements SessionStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(input: CreateSessionInput): Promise<StoredSession> {
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        approxLocation: input.approxLocation,
        lastActiveAt: input.lastActiveAt,
        expiresAt: input.expiresAt,
        rotatedFrom: input.rotatedFrom,
      })
      .returning();
    return row as StoredSession;
  }

  async findByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    return (row as StoredSession | undefined) ?? null;
  }

  async findActiveById(id: string, userId: string): Promise<StoredSession | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .limit(1);
    return (row as StoredSession | undefined) ?? null;
  }

  async listActiveForUser(userId: string, now: Date): Promise<StoredSession[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      );
    return rows as StoredSession[];
  }

  async touchLastActive(id: string, at: Date): Promise<void> {
    await this.db.update(sessions).set({ lastActiveAt: at }).where(eq(sessions.id, id));
  }

  async revokeById(id: string, userId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async revokeOthers(userId: string, keepId: string, at: Date): Promise<number> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(eq(sessions.userId, userId), ne(sessions.id, keepId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length;
  }

  async revokeAll(userId: string, at: Date): Promise<number> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length;
  }
}
