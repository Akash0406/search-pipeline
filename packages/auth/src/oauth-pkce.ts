/**
 * OAuth PKCE + signed single-use `state` (AUTH-001, Req 4.1, PRIV-004).
 *
 * The Authorization Code + PKCE flow needs two secrets carried across the
 * redirect: the `state` (CSRF defense) and the PKCE `code_verifier`. Rather
 * than a server-side table, this service seals BOTH into a single HMAC-signed,
 * time-limited "login transaction" token that the API stores in an HttpOnly
 * cookie at `/start` and verifies at `/callback`.
 *
 * Single-use is achieved by the caller deleting the cookie on callback; the
 * signature + short TTL prevent forgery/replay, and the `state` in the sealed
 * payload must equal the `state` echoed back by the provider (double-submit).
 */
import type { Clock, CryptoProvider } from './ports.js';

/** PKCE code-verifier length in bytes (43–128 chars once base64url-encoded). */
const CODE_VERIFIER_BYTES = 32;

/** Default validity of a login transaction (10 minutes). */
export const DEFAULT_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** The PKCE material handed to the authorization request. */
export interface PkceChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/** Decoded contents of a sealed login transaction. */
export interface OAuthLoginTransaction {
  state: string;
  codeVerifier: string;
  returnTo?: string;
  createdAt: number;
}

/** Everything the API needs to begin the redirect. */
export interface StartedOAuthLogin {
  /** Value echoed to the provider as `state`. */
  state: string;
  challenge: PkceChallenge;
  /** Opaque, signed token to store in an HttpOnly cookie. */
  sealed: string;
}

export interface OAuthStateServiceDeps {
  crypto: CryptoProvider;
  clock: Clock;
  /** Signing secret (from `config.auth.session.secret`). */
  secret: string;
  /** Transaction TTL in ms (defaults to 10 minutes). */
  ttlMs?: number;
}

export class OAuthStateService {
  private readonly crypto: CryptoProvider;
  private readonly clock: Clock;
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(deps: OAuthStateServiceDeps) {
    this.crypto = deps.crypto;
    this.clock = deps.clock;
    this.secret = deps.secret;
    this.ttlMs = deps.ttlMs ?? DEFAULT_OAUTH_STATE_TTL_MS;
  }

  /** Create a fresh PKCE challenge (S256). */
  createPkceChallenge(): PkceChallenge {
    const codeVerifier = this.crypto.randomToken(CODE_VERIFIER_BYTES);
    return {
      codeVerifier,
      codeChallenge: this.crypto.sha256Base64Url(codeVerifier),
      codeChallengeMethod: 'S256',
    };
  }

  /** Begin a login: mint state + PKCE and seal them into a signed token. */
  start(returnTo?: string): StartedOAuthLogin {
    const state = this.crypto.randomToken(16);
    const challenge = this.createPkceChallenge();
    const txn: OAuthLoginTransaction = {
      state,
      codeVerifier: challenge.codeVerifier,
      createdAt: this.clock().getTime(),
      ...(returnTo !== undefined ? { returnTo } : {}),
    };
    return { state, challenge, sealed: this.seal(txn) };
  }

  /**
   * Verify a sealed transaction against the `state` echoed by the provider.
   * Returns the decoded transaction (with the PKCE verifier) or null if the
   * signature is invalid, the token expired, or the state does not match.
   */
  verify(sealed: string, stateFromProvider: string): OAuthLoginTransaction | null {
    const txn = this.open(sealed);
    if (!txn) return null;
    if (this.clock().getTime() - txn.createdAt > this.ttlMs) return null;
    if (!this.crypto.timingSafeEqual(txn.state, stateFromProvider)) return null;
    return txn;
  }

  /** Sign + encode a transaction as `<payload>.<sig>` (both base64url). */
  private seal(txn: OAuthLoginTransaction): string {
    const payload = Buffer.from(JSON.stringify(txn), 'utf8').toString('base64url');
    const sig = this.crypto.hmac(payload, this.secret);
    return `${payload}.${sig}`;
  }

  /** Verify signature and decode; null on any tampering/format error. */
  private open(sealed: string): OAuthLoginTransaction | null {
    const dot = sealed.indexOf('.');
    if (dot <= 0) return null;
    const payload = sealed.slice(0, dot);
    const sig = sealed.slice(dot + 1);
    const expected = this.crypto.hmac(payload, this.secret);
    if (!this.crypto.timingSafeEqual(sig, expected)) return null;
    try {
      const json = Buffer.from(payload, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as OAuthLoginTransaction;
      if (
        typeof parsed?.state !== 'string' ||
        typeof parsed?.codeVerifier !== 'string' ||
        typeof parsed?.createdAt !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
