/**
 * Cookie helpers for the auth flows.
 *
 * - Session cookie: HttpOnly + Secure + SameSite (from config). Holds only the
 *   raw session token; the server stores its hash.
 * - CSRF cookie: readable by the client (NOT HttpOnly) for the double-submit
 *   pattern.
 * - OAuth transaction cookie: HttpOnly, short-lived, SameSite=Lax so it
 *   survives the top-level GET redirect back from the provider.
 */
import type { FastifyReply } from 'fastify';
import type { Config } from '@careerstack/config';
import { CSRF_COOKIE_NAME } from '@careerstack/auth';

/** Cookie holding the sealed OAuth PKCE+state transaction. */
export const OAUTH_TXN_COOKIE_NAME = 'cs_oauth_txn';

type SameSite = 'strict' | 'lax' | 'none';

function sessionSameSite(config: Config): SameSite {
  return config.auth.session.cookieSameSite;
}

/** Set the session cookie carrying the raw token, expiring with the session. */
export function setSessionCookie(
  reply: FastifyReply,
  config: Config,
  rawToken: string,
  expiresAt: Date,
): void {
  reply.setCookie(config.auth.session.cookieName, rawToken, {
    httpOnly: true,
    secure: config.auth.session.cookieSecure,
    sameSite: sessionSameSite(config),
    path: '/',
    expires: expiresAt,
  });
}

/** Clear the session cookie (logout / deletion). */
export function clearSessionCookie(reply: FastifyReply, config: Config): void {
  reply.clearCookie(config.auth.session.cookieName, { path: '/' });
}

/** Set the readable CSRF double-submit cookie. */
export function setCsrfCookie(reply: FastifyReply, config: Config, token: string): void {
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: config.auth.session.cookieSecure,
    sameSite: sessionSameSite(config),
    path: '/',
  });
}

/** Set the short-lived HttpOnly OAuth transaction cookie. */
export function setOAuthTxnCookie(reply: FastifyReply, config: Config, sealed: string): void {
  reply.setCookie(OAUTH_TXN_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: config.auth.session.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes, matches the transaction TTL
  });
}

/** Clear the OAuth transaction cookie (single-use). */
export function clearOAuthTxnCookie(reply: FastifyReply): void {
  reply.clearCookie(OAUTH_TXN_COOKIE_NAME, { path: '/' });
}
