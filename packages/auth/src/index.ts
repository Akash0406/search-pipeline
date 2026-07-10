/**
 * `@careerstack/auth` — framework-agnostic auth core.
 *
 * Contains ONLY pure logic and injected-port interfaces: session
 * issue/rotate/revoke with secure token hashing, PKCE + signed single-use OAuth
 * state, magic-link token generation/verification, and CSRF double-submit
 * helpers. It imports no framework (NestJS/Fastify) or adapter (Drizzle/ioredis)
 * so every service is deterministic and unit-testable. Concrete crypto/clock/
 * store implementations are injected by `apps/api`.
 *
 * Design: Auth §6.
 */
export const AUTH_PACKAGE = '@careerstack/auth' as const;

// Ports (interfaces implemented by the caller)
export type {
  Clock,
  CryptoProvider,
  SessionStore,
  StoredSession,
  CreateSessionInput,
  MagicLinkStore,
  StoredMagicLink,
  CreateMagicLinkInput,
} from './ports.js';

// Node crypto implementation of the CryptoProvider port
export { nodeCryptoProvider, toBase64Url, DEFAULT_TOKEN_BYTES } from './crypto.js';

// Session management
export {
  SessionService,
  type SessionServiceConfig,
  type SessionServiceDeps,
  type SessionContext,
  type IssuedSession,
} from './session-service.js';

// Magic-link sign-in
export {
  MagicLinkService,
  MAGIC_LINK_MAX_TTL_MINUTES,
  type MagicLinkServiceConfig,
  type MagicLinkServiceDeps,
  type IssuedMagicLink,
  type MagicLinkFailure,
  type MagicLinkVerifyResult,
} from './magic-link-service.js';

// OAuth PKCE + signed state
export {
  OAuthStateService,
  DEFAULT_OAUTH_STATE_TTL_MS,
  type PkceChallenge,
  type OAuthLoginTransaction,
  type StartedOAuthLogin,
  type OAuthStateServiceDeps,
} from './oauth-pkce.js';

// CSRF double-submit
export { CsrfService, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.js';
