/**
 * Shared transport types for the security package.
 *
 * `packages/security` is the single outbound-HTTP chokepoint, so the canonical
 * `FetchResult`/`SafeFetchOptions`/`SafeFetcher` shapes live here. Connectors
 * (which never open sockets themselves) consume these types via an injected
 * {@link SafeFetcher}.
 */

/** HTTP methods the fetcher permits. Bodyless by design (read-only crawler). */
export type HttpMethod = 'GET' | 'HEAD';

/**
 * Domain allow/deny policy (Req 31.7). Both lists hold bare hostnames or
 * registrable domains (e.g. `example.com`); a host matches an entry when it
 * equals the entry or is a subdomain of it. The deny-list always wins.
 */
export interface DomainPolicy {
  allow?: string[];
  deny?: string[];
}

/** Conditional-request validators carried from a stored checkpoint (Req 26.3). */
export interface ConditionalHeaders {
  etag?: string;
  lastModified?: string;
}

/** Per-request options passed to {@link SafeFetcher.fetch}. */
export interface SafeFetchOptions {
  /** HTTP method (defaults to `GET`). */
  method?: HttpMethod;
  /** Extra request headers. Credential headers are stripped (Req 28). */
  headers?: Record<string, string>;
  /** Allowed response content-types (prefix/mime match) — Req 31.6. */
  allowedContentTypes: string[];
  /** Hard cap on response size in bytes — Req 31.4. */
  maxBytes: number;
  /** Request timeout in milliseconds — Req 31.5. */
  timeoutMs: number;
  /** Maximum redirects followed for a single fetch — Req 31.3. */
  maxRedirects: number;
  /** Conditional validators (If-None-Match / If-Modified-Since) — Req 26.3. */
  conditional?: ConditionalHeaders;
  /** Domain allow/deny policy — Req 31.7. */
  domainPolicy?: DomainPolicy;
  /** Honour robots directives where applicable — Req 31.2. */
  respectRobots?: boolean;
  /** Override the descriptive User-Agent for this request — Req 31.1. */
  userAgent?: string;
}

/**
 * Transport-level result of a single fetch (distinct from the persisted
 * `RawArtifact` entity). Mirrors the design's `FetchResult`.
 */
export interface FetchResult {
  /** URL after all redirects were followed. */
  finalUrl: string;
  /** HTTP status code (e.g. 200 or 304). */
  status: number;
  /** True when a conditional GET short-circuited with 304 (Req 26.3). */
  notModified: boolean;
  /** Lower-cased response headers. */
  headers: Record<string, string>;
  /** Parsed content-type (media type only, lower-cased). */
  contentType: string;
  /** Response body, capped at `maxBytes` (empty when `notModified`). */
  body: Buffer;
  /** Number of bytes in `body`. */
  byteSize: number;
  /** ETag validator for the next conditional request, when present. */
  etag?: string;
  /** Last-Modified validator for the next conditional request, when present. */
  lastModified?: string;
}

/**
 * The single outbound-HTTP contract. No connector may reach the network except
 * through an implementation of this interface.
 */
export interface SafeFetcher {
  fetch(url: string, opts: SafeFetchOptions): Promise<FetchResult>;
}
