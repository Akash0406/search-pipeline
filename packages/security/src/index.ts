/**
 * `@careerstack/security` — the single outbound-HTTP chokepoint and related
 * pure security policy for CareerStack (Design Security §2).
 *
 * Exposes:
 *  - {@link canonicalizeUrl} — pure canonical URL normalizer (identity key);
 *  - the SSRF guard ({@link isBlockedIp}, {@link assertSafeAddress},
 *    {@link validateResolvedHost}) — pure policy over resolved addresses;
 *  - {@link SafeFetcher} — the enforcing outbound HTTP fetcher;
 *  - the per-domain {@link RateLimiter} (in-memory + Redis) and backoff util;
 *  - {@link sanitizeHtml} — allowlist HTML sanitizer for stored descriptions.
 */

export const SECURITY_PACKAGE = '@careerstack/security' as const;

// Errors
export {
  SecurityError,
  type SecurityErrorCode,
  InvalidUrlError,
  DomainBlockedError,
  RobotsDisallowedError,
  SsrfBlockedError,
  RateLimitedError,
  TimeoutError,
  TooManyRedirectsError,
  ContentTypeError,
  MaxBytesExceededError,
} from './errors.js';

// Transport types
export type {
  HttpMethod,
  DomainPolicy,
  ConditionalHeaders,
  SafeFetchOptions,
  FetchResult,
  SafeFetcher as SafeFetcherContract,
} from './types.js';

// Canonical URL (Task 7.1)
export { canonicalizeUrl } from './canonical-url.js';

// SSRF guard (Task 7.2)
export {
  CLOUD_METADATA_ADDRESSES,
  isBlockedIp,
  assertSafeAddress,
  validateResolvedHost,
} from './ssrf.js';

// Domain helpers
export { registrableDomain, isDomainAllowed, isPublicHost } from './domain.js';

// SafeFetcher (Task 7.3)
export {
  SafeFetcher,
  type SafeFetcherDeps,
  type SafeFetcherConfig,
  type DnsResolver,
  type FetchImpl,
  type FetchInit,
} from './safe-fetcher.js';

// Robots
export {
  type RobotsChecker,
  AllowAllRobotsChecker,
  CachedRobotsChecker,
  type RobotsTextFetcher,
  type RobotRules,
  parseRobots,
  isPathAllowed,
} from './robots.js';

// Rate limiter + backoff (Task 7.4)
export {
  type RateLimiter,
  type RateLimitDecision,
  type RateLimiterOptions,
  rateLimiterOptionsFromConfig,
  InMemoryRateLimiter,
  RedisRateLimiter,
  type RedisEvalClient,
  computeBackoffMs,
  type BackoffOptions,
} from './rate-limiter.js';

// HTML sanitizer (Task 7.5)
export { sanitizeHtml } from './sanitize.js';
