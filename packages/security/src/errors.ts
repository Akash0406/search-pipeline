/**
 * Typed error hierarchy for the security package.
 *
 * Every failure mode of the {@link SafeFetcher} enforcement pipeline and the
 * SSRF guard raises a subclass of {@link SecurityError} carrying a stable,
 * machine-readable `code`. Callers (connectors, the worker) branch on `code`
 * to decide whether to defer/re-enqueue (rate limit), route to review, or fail
 * the run — without string-matching messages.
 */

/** Stable error codes emitted by this package. */
export type SecurityErrorCode =
  | 'INVALID_URL'
  | 'DOMAIN_BLOCKED'
  | 'ROBOTS_DISALLOWED'
  | 'SSRF_BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'CONTENT_TYPE_REJECTED'
  | 'MAX_BYTES_EXCEEDED';

/** Base class for all security failures. */
export class SecurityError extends Error {
  public readonly code: SecurityErrorCode;

  constructor(code: SecurityErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The supplied URL could not be parsed or used an unsupported scheme. */
export class InvalidUrlError extends SecurityError {
  constructor(message: string) {
    super('INVALID_URL', message);
  }
}

/** The target domain is on the deny-list (deny beats allow) — Req 31.7. */
export class DomainBlockedError extends SecurityError {
  public readonly domain: string;

  constructor(domain: string, reason = 'denied by domain policy') {
    super('DOMAIN_BLOCKED', `Domain "${domain}" is ${reason}.`);
    this.domain = domain;
  }
}

/** A robots directive disallows fetching the target path — Req 31.2. */
export class RobotsDisallowedError extends SecurityError {
  public readonly url: string;

  constructor(url: string) {
    super('ROBOTS_DISALLOWED', `Fetching "${url}" is disallowed by robots rules.`);
    this.url = url;
  }
}

/**
 * A resolved address is private/loopback/link-local/reserved or a cloud
 * metadata endpoint — Req 30.1, 30.2 (and re-checked per redirect, Req 30.3).
 */
export class SsrfBlockedError extends SecurityError {
  public readonly ip: string | undefined;
  public readonly host: string | undefined;

  constructor(message: string, detail: { ip?: string; host?: string } = {}) {
    super('SSRF_BLOCKED', message);
    this.ip = detail.ip;
    this.host = detail.host;
  }
}

/**
 * The per-domain rate limit is exhausted. This is a *deferral* signal — the
 * caller should re-enqueue the request after `retryAfterMs`, never drop it
 * (Req 27.2).
 */
export class RateLimitedError extends SecurityError {
  public readonly retryAfterMs: number;
  public readonly domain: string;

  constructor(domain: string, retryAfterMs: number) {
    super('RATE_LIMITED', `Rate limit reached for "${domain}"; retry after ${retryAfterMs}ms.`);
    this.domain = domain;
    this.retryAfterMs = retryAfterMs;
  }
}

/** The request exceeded the configured timeout — Req 31.5. */
export class TimeoutError extends SecurityError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super('TIMEOUT', `Request aborted after exceeding ${timeoutMs}ms timeout.`);
    this.timeoutMs = timeoutMs;
  }
}

/** More than `maxRedirects` redirects were encountered — Req 31.3. */
export class TooManyRedirectsError extends SecurityError {
  public readonly maxRedirects: number;

  constructor(maxRedirects: number) {
    super('TOO_MANY_REDIRECTS', `Exceeded the maximum of ${maxRedirects} redirects.`);
    this.maxRedirects = maxRedirects;
  }
}

/** The response content-type is outside the connector's allowed set — Req 31.6. */
export class ContentTypeError extends SecurityError {
  public readonly contentType: string;

  constructor(contentType: string, allowed: readonly string[]) {
    super(
      'CONTENT_TYPE_REJECTED',
      `Content-Type "${contentType}" is not in the allowed set [${allowed.join(', ')}].`,
    );
    this.contentType = contentType;
  }
}

/** The response exceeded `maxBytes` (via header or streamed bytes) — Req 31.4. */
export class MaxBytesExceededError extends SecurityError {
  public readonly maxBytes: number;

  constructor(maxBytes: number) {
    super('MAX_BYTES_EXCEEDED', `Response exceeded the maximum of ${maxBytes} bytes.`);
    this.maxBytes = maxBytes;
  }
}
