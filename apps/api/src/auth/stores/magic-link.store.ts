/**
 * Drizzle-backed {@link MagicLinkStore} over the `magic_link_tokens` table.
 *
 * Only the token HASH is ever stored (Req 5). `markUsed` flips `used_at` only
 * when it is still null and returns whether THIS call performed the transition,
 * guaranteeing single-use even under a concurrent double-submit (Req 5.3).
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { magicLinkTokens } from '@careerstack/database';
import type { CreateMagicLinkInput, MagicLinkStore, StoredMagicLink } from '@careerstack/auth';
import { DB } from '../../common/di-tokens.js';

@Injectable()
export class DrizzleMagicLinkStore implements MagicLinkStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(input: CreateMagicLinkInput): Promise<StoredMagicLink> {
    const [row] = await this.db
      .insert(magicLinkTokens)
      .values({
        userId: input.userId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    return row as StoredMagicLink;
  }

  async findByTokenHash(tokenHash: string): Promise<StoredMagicLink | null> {
    const [row] = await this.db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.tokenHash, tokenHash))
      .limit(1);
    return (row as StoredMagicLink | undefined) ?? null;
  }

  async markUsed(id: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(magicLinkTokens)
      .set({ usedAt: at })
      .where(and(eq(magicLinkTokens.id, id), isNull(magicLinkTokens.usedAt)))
      .returning({ id: magicLinkTokens.id });
    return rows.length > 0;
  }
}
