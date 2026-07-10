/**
 * Injected ports for the framework-agnostic auth core.
 *
 * The auth package contains ONLY pure logic + these interfaces. Concrete
 * implementations (Node crypto, a system clock, Drizzle-backed stores) are
 * supplied by the caller (`apps/api`) so every service here is deterministic
 * and unit-testable with fakes.
 *
 * Design: Auth §6 — "Pure functions/services with injected clock + crypto +
 * repository interfaces so they are unit-testable."
 */

/** Injectable clock so callers/tests control time. */
export type Clock = () => Date;

/**
 * Cryptographic primitives the auth core needs. The Node implementation lives
 * in `./crypto.ts`; tests may substitute a deterministic fake.
 */
export interface CryptoProvider {
  /** Generate a cryptographically-random token, URL-safe (base64url). */
  randomToken(byteLength?: number): string;
  /** Stable one-way hash (hex) used to store token hashes, never raw tokens. */
  hashToken(rawToken: string): string;
  /** Keyed HMAC-SHA256 signature (base64url) used to sign OAuth state. */
  hmac(message: string, secret: string): string;
  /** SHA-256 of the input as base64url (used for the PKCE S256 challenge). */
  sha256Base64Url(input: string): string;
  /** Constant-time string comparison to avoid timing side-channels. */
  timingSafeEqual(a: string, b: string): boolean;
}

// -- Session persistence port ------------------------------------------------

/** A persisted session as the auth core understands it (adapter-neutral). */
export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipHash: string | null;
  approxLocation: string | null;
  lastActiveAt: Date;
  rotatedFrom: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Fields required to persist a new session row. */
export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipHash: string | null;
  approxLocation: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  rotatedFrom: string | null;
}

/**
 * Persistence port for sessions. The API implements this over the `sessions`
 * table; every method that targets a specific user takes the `userId` so the
 * ownership predicate is always present (PRIV-006 / Req 54).
 */
export interface SessionStore {
  create(input: CreateSessionInput): Promise<StoredSession>;
  findByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  findActiveById(id: string, userId: string): Promise<StoredSession | null>;
  listActiveForUser(userId: string, now: Date): Promise<StoredSession[]>;
  touchLastActive(id: string, at: Date): Promise<void>;
  /** Revoke a single session owned by `userId`; returns true when one changed. */
  revokeById(id: string, userId: string, at: Date): Promise<boolean>;
  /** Revoke every active session for `userId` except `keepId`; returns count. */
  revokeOthers(userId: string, keepId: string, at: Date): Promise<number>;
  /** Revoke every active session for `userId`; returns count. */
  revokeAll(userId: string, at: Date): Promise<number>;
}

// -- Magic-link persistence port --------------------------------------------

/** A persisted magic-link token (hash only — never the raw token). */
export interface StoredMagicLink {
  id: string;
  userId: string | null;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface CreateMagicLinkInput {
  userId: string | null;
  email: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Persistence port for single-use, time-limited magic-link tokens (Req 5). */
export interface MagicLinkStore {
  create(input: CreateMagicLinkInput): Promise<StoredMagicLink>;
  findByTokenHash(tokenHash: string): Promise<StoredMagicLink | null>;
  /**
   * Atomically mark a token used. Returns true only if THIS call transitioned
   * it from unused → used (guaranteeing single-use even under a race).
   */
  markUsed(id: string, at: Date): Promise<boolean>;
}
