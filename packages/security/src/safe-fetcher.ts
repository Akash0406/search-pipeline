/**
 * SafeFetcher — the single outbound-HTTP chokepoint (Req 26.3, 28.2–28.4, 30,
 * 31; Design Security §2).
 *
 * `SafeFetcher.fetch()` enforces, in order:
 *  1. domain deny/allow policy (deny beats allow) — Req 31.7;
 *  2. robots directives where applicable, cached per host — Req 31.2;
 *  3. per-domain rate limiting (deferral, never dropped) — Req 27.1/27.2;
 *  4. DNS resolution + SSRF guard, pinning the connection to a validated IP
 *     against DNS rebinding — Req 30.1/30.2;
 *  5. a descriptive User-Agent — Req 31.1;
 *  6. conditional headers (If-None-Match / If-Modified-Since); a 304
 *     short-circuits with `notModified` and no body — Req 26.3;
 *  7. a request timeout — Req 31.5;
 *  8. a redirect cap with per-hop SSRF re-validation — Req 31.3, 30.3;
 *  9. content-type allow-set validation — Req 31.6;
 * 10. a streamed max-bytes cap (aborting mid-stream) — Req 31.4.
 *
 * Hard blockers (Req 28): the fetcher strips credential headers (Authorization,
 * Cookie, Proxy-Authorization) and never injects auth, never bypasses
 * CAPTCHA/anti-bot measures, and offers no auto-apply path.
 *
 * All collaborators (DNS resolver, rate limiter, robots checker, clock, the
 * underlying fetch, and an optional pinned-dispatcher factory) are injected so
 * the pipeline is deterministic and unit-testable.
 */

import type { Clock, Logger } from '@careerstack/observability';
import type { FetchConfig } from '@careerstack/config';
import {
  ContentTypeError,
  DomainBlockedError,
  InvalidUrlError,
  MaxBytesExceededError,
  RateLimitedError,
  RobotsDisallowedError,
  TimeoutError,
  TooManyRedirectsError,
} from './errors.js';
import { isDomainAllowed } from './domain.js';
import { validateResolvedHost } from './ssrf.js';
import { AllowAllRobotsChecker, type RobotsChecker } from './robots.js';
import type { RateLimiter } from './rate-limiter.js';
import type { FetchResult, HttpMethod, SafeFetchOptions } from './types.js';

/** Resolves a hostname to its IP addresses (injectable for tests/pinning). */
export interface DnsResolver {
  resolve(host: string): Promise<string[]>;
}

/** Init passed to the underlying fetch implementation. */
export interface FetchInit {
  method: string;
  headers: Record<string, string>;
  redirect: 'manual';
  signal: AbortSignal;
  /** Optional undici dispatcher used to pin the connection to a validated IP. */
  dispatcher?: unknown;
}

/** The underlying fetch (defaults to global `fetch`); injectable for tests. */
export type FetchImpl = (url: string, init: FetchInit) => Promise<Response>;

/** Bounds/defaults sourced from `@careerstack/config`'s fetch config. */
export type SafeFetcherConfig = Pick<FetchConfig, 'userAgent'> &
  Partial<Pick<FetchConfig, 'allowedDomains' | 'deniedDomains'>>;

/** Injected collaborators + static config for a {@link SafeFetcher}. */
export interface SafeFetcherDeps {
  config: SafeFetcherConfig;
  resolver?: DnsResolver;
  rateLimiter?: RateLimiter;
  robots?: RobotsChecker;
  clock?: Clock;
  logger?: Logger;
  fetchImpl?: FetchImpl;
  /** Build an undici dispatcher pinned to validated IPs (anti-rebinding). */
  dispatcherFactory?: (pinnedIps: string[], host: string) => unknown;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const STRIPPED_REQUEST_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);

/** Default DNS resolver backed by the OS resolver (`node:dns`). */
class NodeDnsResolver implements DnsResolver {
  async resolve(host: string): Promise<string[]> {
    const { lookup } = await import('node:dns/promises');
    const records = await lookup(host, { all: true });
    return records.map((r) => r.address);
  }
}

function parseHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new InvalidUrlError(`Malformed URL: "${input}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError(`Unsupported scheme "${url.protocol}" for fetch.`);
  }
  return url;
}

/** Media type only (lower-cased), stripped of parameters like `; charset=…`. */
function mediaType(contentType: string | null): string {
  if (!contentType) {
    return '';
  }
  const semi = contentType.indexOf(';');
  return (semi === -1 ? contentType : contentType.slice(0, semi)).trim().toLowerCase();
}

/** True when `type` matches any allow-set entry (supports `type` wildcards and a match-all). */
function matchesContentType(type: string, allowed: readonly string[]): boolean {
  return allowed.some((entry) => {
    const e = entry.trim().toLowerCase();
    if (e === '*/*' || e === '*') {
      return true;
    }
    if (e.endsWith('/*')) {
      return type.startsWith(e.slice(0, -1));
    }
    return type === e;
  });
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/** Read a web stream into a Buffer, aborting once `maxBytes` is exceeded. */
async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  abort: AbortController,
): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          abort.abort();
          throw new MaxBytesExceededError(maxBytes);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export class SafeFetcher {
  private readonly resolver: DnsResolver;
  private readonly rateLimiter: RateLimiter | undefined;
  private readonly robots: RobotsChecker;
  private readonly logger: Logger | undefined;
  private readonly fetchImpl: FetchImpl;
  private readonly dispatcherFactory: SafeFetcherDeps['dispatcherFactory'];
  private readonly config: SafeFetcherConfig;

  constructor(deps: SafeFetcherDeps) {
    this.config = deps.config;
    this.resolver = deps.resolver ?? new NodeDnsResolver();
    this.rateLimiter = deps.rateLimiter;
    this.robots = deps.robots ?? new AllowAllRobotsChecker();
    this.logger = deps.logger;
    this.fetchImpl =
      deps.fetchImpl ?? ((url, init) => fetch(url, init as unknown as RequestInit));
    this.dispatcherFactory = deps.dispatcherFactory;
  }

  async fetch(url: string, opts: SafeFetchOptions): Promise<FetchResult> {
    const method: HttpMethod = opts.method ?? 'GET';
    const userAgent = opts.userAgent ?? this.config.userAgent;
    const domainPolicy = opts.domainPolicy ?? {
      ...(this.config.allowedDomains ? { allow: this.config.allowedDomains } : {}),
      ...(this.config.deniedDomains ? { deny: this.config.deniedDomains } : {}),
    };

    let currentUrl = url;
    let redirectCount = 0;

    for (;;) {
      const parsed = parseHttpUrl(currentUrl);
      const host = parsed.hostname;

      // 1. Domain policy (deny beats allow) — Req 31.7.
      if (!isDomainAllowed(host, domainPolicy)) {
        throw new DomainBlockedError(host);
      }

      // 2. Robots — Req 31.2.
      if (opts.respectRobots) {
        const allowed = await this.robots.isAllowed(currentUrl, userAgent);
        if (!allowed) {
          throw new RobotsDisallowedError(currentUrl);
        }
      }

      // 3. Per-domain rate limit — Req 27.1/27.2 (defer, never drop).
      if (this.rateLimiter) {
        const decision = await this.rateLimiter.acquire(host);
        if (!decision.allowed) {
          throw new RateLimitedError(decision.domain, decision.retryAfterMs);
        }
      }

      // 4. DNS resolve + SSRF guard, then pin — Req 30.1/30.2 (+30.3 per hop).
      const ips = await this.resolver.resolve(host);
      const validatedIps = validateResolvedHost(host, ips);

      // 5–7. Build the request, attach the pinned dispatcher, and time it out.
      const requestHeaders = this.buildHeaders(opts, userAgent);
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), opts.timeoutMs);

      let response: Response;
      try {
        const init: FetchInit = {
          method,
          headers: requestHeaders,
          redirect: 'manual',
          signal: abort.signal,
        };
        if (this.dispatcherFactory) {
          init.dispatcher = this.dispatcherFactory(validatedIps, host);
        }
        response = await this.fetchImpl(currentUrl, init);
      } catch (err) {
        clearTimeout(timer);
        if (abort.signal.aborted) {
          throw new TimeoutError(opts.timeoutMs);
        }
        throw err;
      }
      clearTimeout(timer);

      // 8. Redirects — cap + re-validate SSRF on the next hop — Req 31.3/30.3.
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          redirectCount += 1;
          if (redirectCount > opts.maxRedirects) {
            throw new TooManyRedirectsError(opts.maxRedirects);
          }
          currentUrl = new URL(location, currentUrl).toString();
          // Drain the redirect response body to free the socket.
          await response.arrayBuffer().catch(() => undefined);
          continue;
        }
      }

      // 6 (cont). Conditional 304 short-circuit — Req 26.3.
      if (response.status === 304) {
        await response.arrayBuffer().catch(() => undefined);
        return this.buildResult(currentUrl, response, mediaType(null), Buffer.alloc(0), true);
      }

      const contentType = mediaType(response.headers.get('content-type'));

      // 9. Content-type allow-set — Req 31.6 (skip for bodyless HEAD).
      if (method !== 'HEAD' && !matchesContentType(contentType, opts.allowedContentTypes)) {
        abort.abort();
        throw new ContentTypeError(contentType, opts.allowedContentTypes);
      }

      // 10. Size cap: reject early on Content-Length, then stream-cap — Req 31.4.
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > opts.maxBytes) {
        abort.abort();
        throw new MaxBytesExceededError(opts.maxBytes);
      }

      const body =
        method === 'HEAD'
          ? Buffer.alloc(0)
          : await readCapped(response.body, opts.maxBytes, abort);

      this.logger?.debug('security.fetch.completed', {
        stage: 'fetch',
        outcome: 'success',
        finalUrl: currentUrl,
        status: response.status,
        byteSize: body.byteLength,
      });

      return this.buildResult(currentUrl, response, contentType, body, false);
    }
  }

  private buildHeaders(opts: SafeFetchOptions, userAgent: string): Record<string, string> {
    const headers: Record<string, string> = {};
    // Copy caller headers, dropping any credential-bearing header (Req 28).
    for (const [key, value] of Object.entries(opts.headers ?? {})) {
      if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    headers['user-agent'] = userAgent; // Req 31.1
    if (opts.conditional?.etag) {
      headers['if-none-match'] = opts.conditional.etag; // Req 26.3
    }
    if (opts.conditional?.lastModified) {
      headers['if-modified-since'] = opts.conditional.lastModified; // Req 26.3
    }
    return headers;
  }

  private buildResult(
    finalUrl: string,
    response: Response,
    contentType: string,
    body: Buffer,
    notModified: boolean,
  ): FetchResult {
    const headers = headersToObject(response.headers);
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    return {
      finalUrl,
      status: response.status,
      notModified,
      headers,
      contentType,
      body,
      byteSize: body.byteLength,
      ...(etag ? { etag } : {}),
      ...(lastModified ? { lastModified } : {}),
    };
  }
}
