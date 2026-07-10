/**
 * Session issue / authenticate / rotate / revoke (AUTH-003, Req 6).
 *
 * Sessions are server-side and referenced by a secure, HttpOnly, SameSite
 * cookie. The RAW token is returned exactly once (for the cookie); only its
 * hash is persisted via the {@link SessionStore}. The session id rotates on a
 * privilege change (`rotate`), preserving lineage through `rotatedFrom`.
 */
import type { Clock, CryptoProvider, SessionStore, StoredSession } from './ports.js';

export interface SessionServiceConfig {
  /** Session lifetime in hours (from `config.auth.session.ttlHours`). */
  ttlHours: number;
}

export interface SessionServiceDeps {
  store: SessionStore;
  crypto: CryptoProvider;
  clock: Clock;
  config: SessionServiceConfig;
}

/** Context recorded when a session is issued (device / location metadata). */
export interface SessionContext {
  userAgent?: string | null;
  ipHash?: string | null;
  approxLocation?: string | null;
}

/** Result of issuing a session: the stored row plus the one-time raw token. */
export interface IssuedSession {
  session: StoredSession;
  /** Raw token — placed in the cookie and NEVER stored server-side. */
  rawToken: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

export class SessionService {
  private readonly store: SessionStore;
  private readonly crypto: CryptoProvider;
  private readonly clock: Clock;
  private readonly ttlMs: number;

  constructor(deps: SessionServiceDeps) {
    this.store = deps.store;
    this.crypto = deps.crypto;
    this.clock = deps.clock;
    this.ttlMs = deps.config.ttlHours * MS_PER_HOUR;
  }

  /** Issue a brand-new session for a user, returning the raw cookie token. */
  async issue(userId: string, ctx: SessionContext = {}): Promise<IssuedSession> {
    return this.issueInternal(userId, ctx, null);
  }

  private async issueInternal(
    userId: string,
    ctx: SessionContext,
    rotatedFrom: string | null,
  ): Promise<IssuedSession> {
    const now = this.clock();
    const rawToken = this.crypto.randomToken();
    const tokenHash = this.crypto.hashToken(rawToken);
    const session = await this.store.create({
      userId,
      tokenHash,
      userAgent: ctx.userAgent ?? null,
      ipHash: ctx.ipHash ?? null,
      approxLocation: ctx.approxLocation ?? null,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      rotatedFrom,
    });
    return { session, rawToken };
  }

  /**
   * Resolve a raw cookie token to its active session. Returns null when the
   * token is unknown, revoked, or expired. Touches `lastActiveAt` on success.
   */
  async authenticate(rawToken: string): Promise<StoredSession | null> {
    if (!rawToken) return null;
    const tokenHash = this.crypto.hashToken(rawToken);
    const session = await this.store.findByTokenHash(tokenHash);
    if (!session) return null;

    const now = this.clock();
    if (session.revokedAt !== null) return null;
    if (session.expiresAt.getTime() <= now.getTime()) return null;

    await this.store.touchLastActive(session.id, now);
    return { ...session, lastActiveAt: now };
  }

  /**
   * Rotate the session on a privilege change (AUTH-003): revoke the current
   * session and issue a fresh one linked via `rotatedFrom`. Returns null if the
   * current token no longer maps to an active session.
   */
  async rotate(currentRawToken: string, ctx: SessionContext = {}): Promise<IssuedSession | null> {
    const current = await this.authenticate(currentRawToken);
    if (!current) return null;
    const now = this.clock();
    await this.store.revokeById(current.id, current.userId, now);
    return this.issueInternal(
      current.userId,
      {
        userAgent: ctx.userAgent ?? current.userAgent,
        ipHash: ctx.ipHash ?? current.ipHash,
        approxLocation: ctx.approxLocation ?? current.approxLocation,
      },
      current.id,
    );
  }

  /** Revoke the session identified by the raw cookie token (logout, Req 6.2). */
  async revokeByToken(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = this.crypto.hashToken(rawToken);
    const session = await this.store.findByTokenHash(tokenHash);
    if (!session || session.revokedAt !== null) return false;
    return this.store.revokeById(session.id, session.userId, this.clock());
  }

  /** Revoke a specific session by id, scoped to its owner (Req 6.2, 54). */
  async revokeById(sessionId: string, userId: string): Promise<boolean> {
    return this.store.revokeById(sessionId, userId, this.clock());
  }

  /** Revoke all of the user's sessions except the current one (Req 6.3). */
  async revokeOthers(userId: string, keepSessionId: string): Promise<number> {
    return this.store.revokeOthers(userId, keepSessionId, this.clock());
  }

  /** Revoke every session for the user (account deletion, Req 7.3). */
  async revokeAll(userId: string): Promise<number> {
    return this.store.revokeAll(userId, this.clock());
  }

  /** List the user's active (non-revoked, non-expired) sessions (Req 6.1). */
  async listActive(userId: string): Promise<StoredSession[]> {
    return this.store.listActiveForUser(userId, this.clock());
  }
}
