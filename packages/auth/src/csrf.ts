/**
 * CSRF double-submit token helpers (Design API §7).
 *
 * On login the server issues a random CSRF token, sets it in a readable
 * (non-HttpOnly) cookie, and the client echoes it in a request header on every
 * state-changing request. The server accepts the request only when the cookie
 * value and the header value match (constant-time). Because a cross-site
 * attacker cannot read the cookie to populate the header, forged requests fail.
 */
import type { CryptoProvider } from './ports.js';

/** Cookie name that carries the readable CSRF token. */
export const CSRF_COOKIE_NAME = 'cs_csrf';
/** Header the client must echo the CSRF token in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

export class CsrfService {
  private readonly crypto: CryptoProvider;

  constructor(crypto: CryptoProvider) {
    this.crypto = crypto;
  }

  /** Mint a fresh CSRF token to place in the double-submit cookie. */
  issueToken(): string {
    return this.crypto.randomToken(24);
  }

  /**
   * Validate a double-submit pair. Both values must be present and equal.
   * Comparison is constant-time to avoid a timing side-channel.
   */
  verify(cookieToken: string | undefined | null, headerToken: string | undefined | null): boolean {
    if (!cookieToken || !headerToken) return false;
    return this.crypto.timingSafeEqual(cookieToken, headerToken);
  }
}
