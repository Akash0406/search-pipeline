/**
 * Email magic-link generation + verification (AUTH-002, Req 5).
 *
 * - `issue` creates a random token, stores ONLY its hash, and sets an expiry
 *   bounded to ≤ 15 minutes (Req 5.4). The raw token is returned once so the
 *   caller can embed it in the emailed link.
 * - `verify` consumes a raw token: it must exist, be unexpired, and be unused.
 *   Consumption is atomic (single-use, Req 5.3) via `store.markUsed`.
 *
 * There is NO password path anywhere (Req 5.5).
 */
import type { Clock, CryptoProvider, MagicLinkStore, StoredMagicLink } from './ports.js';

/** Hard upper bound on magic-link validity mandated by Req 5.4. */
export const MAGIC_LINK_MAX_TTL_MINUTES = 15;

export interface MagicLinkServiceConfig {
  /** Requested TTL in minutes; clamped to ≤ 15 (Req 5.4). */
  ttlMinutes: number;
}

export interface MagicLinkServiceDeps {
  store: MagicLinkStore;
  crypto: CryptoProvider;
  clock: Clock;
  config: MagicLinkServiceConfig;
}

export interface IssuedMagicLink {
  /** Raw token to embed in the emailed link — never persisted. */
  rawToken: string;
  record: StoredMagicLink;
}

/** Reason a verification failed, so the caller can offer a resend (Req 5.3). */
export type MagicLinkFailure = 'not_found' | 'expired' | 'used';

export type MagicLinkVerifyResult =
  { ok: true; record: StoredMagicLink } | { ok: false; reason: MagicLinkFailure };

const MS_PER_MINUTE = 60 * 1000;

export class MagicLinkService {
  private readonly store: MagicLinkStore;
  private readonly crypto: CryptoProvider;
  private readonly clock: Clock;
  private readonly ttlMinutes: number;

  constructor(deps: MagicLinkServiceDeps) {
    this.store = deps.store;
    this.crypto = deps.crypto;
    this.clock = deps.clock;
    // Clamp to the mandated maximum so a misconfiguration can never exceed it.
    this.ttlMinutes = Math.min(
      Math.max(1, Math.floor(deps.config.ttlMinutes)),
      MAGIC_LINK_MAX_TTL_MINUTES,
    );
  }

  /** Normalize an email for consistent lookup/storage. */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Generate and persist a single-use, time-limited magic link. */
  async issue(email: string, userId: string | null = null): Promise<IssuedMagicLink> {
    const now = this.clock();
    const rawToken = this.crypto.randomToken();
    const tokenHash = this.crypto.hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + this.ttlMinutes * MS_PER_MINUTE);
    const record = await this.store.create({
      userId,
      email: MagicLinkService.normalizeEmail(email),
      tokenHash,
      expiresAt,
    });
    return { rawToken, record };
  }

  /**
   * Consume a raw token. On success it is atomically marked used so a second
   * verification of the same link fails with `used` (Req 5.3).
   */
  async verify(rawToken: string): Promise<MagicLinkVerifyResult> {
    if (!rawToken) return { ok: false, reason: 'not_found' };
    const tokenHash = this.crypto.hashToken(rawToken);
    const record = await this.store.findByTokenHash(tokenHash);
    if (!record) return { ok: false, reason: 'not_found' };

    const now = this.clock();
    if (record.usedAt !== null) return { ok: false, reason: 'used' };
    if (record.expiresAt.getTime() <= now.getTime()) {
      return { ok: false, reason: 'expired' };
    }

    // Atomic single-use consumption: only the caller that flips unused → used
    // may proceed, closing a double-submit race.
    const consumed = await this.store.markUsed(record.id, now);
    if (!consumed) return { ok: false, reason: 'used' };

    return { ok: true, record };
  }
}
