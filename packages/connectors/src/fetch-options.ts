/**
 * Helpers for building {@link SafeFetchOptions} passed to the injected
 * `SafeFetcher`. Fetch bounds (max bytes / timeout / redirects) come from the
 * connection config when present, otherwise conservative package defaults.
 * Connectors never construct sockets — every request flows through these
 * options into the security package's enforcement pipeline (SEC-002).
 */

import type { Checkpoint, ConnectorContext, SafeFetchOptions } from './types.js';

/** Content-type allow-sets used by the connectors. */
export const JSON_CONTENT_TYPES = ['application/json'] as const;
export const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'] as const;
export const JSONLD_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'application/ld+json',
  'application/json',
] as const;

/** Conservative default fetch bounds (overridable via connection config). */
export const DEFAULT_FETCH_BOUNDS = {
  /** JSON list/detail payloads. */
  json: { maxBytes: 5 * 1024 * 1024, timeoutMs: 15_000, maxRedirects: 3 },
  /** HTML career pages / manual URLs. */
  html: { maxBytes: 8 * 1024 * 1024, timeoutMs: 20_000, maxRedirects: 5 },
} as const;

export interface FetchBounds {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
}

interface BuildFetchOptionsInput {
  ctx: ConnectorContext;
  allowedContentTypes: readonly string[];
  defaults: FetchBounds;
  /** URL used to look up conditional validators from the checkpoint. */
  url?: string;
  checkpoint?: Checkpoint;
  method?: 'GET' | 'HEAD';
}

/**
 * Read a positive-integer bound from `ctx.config.fetchBounds`, falling back to
 * the supplied default. Invalid/absent config never widens a bound.
 */
function boundFromConfig(ctx: ConnectorContext, key: keyof FetchBounds, fallback: number): number {
  const bounds = ctx.config['fetchBounds'];
  if (bounds && typeof bounds === 'object') {
    const candidate = (bounds as Record<string, unknown>)[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.floor(candidate);
    }
  }
  return fallback;
}

function domainPolicyFromConfig(
  ctx: ConnectorContext,
): { allow?: string[]; deny?: string[] } | undefined {
  const policy = ctx.config['domainPolicy'];
  if (!policy || typeof policy !== 'object') return undefined;
  const { allow, deny } = policy as { allow?: unknown; deny?: unknown };
  const result: { allow?: string[]; deny?: string[] } = {};
  if (Array.isArray(allow)) result.allow = allow.filter((v): v is string => typeof v === 'string');
  if (Array.isArray(deny)) result.deny = deny.filter((v): v is string => typeof v === 'string');
  return result.allow || result.deny ? result : undefined;
}

/** Build fetch options, wiring conditional validators from the checkpoint. */
export function buildFetchOptions({
  ctx,
  allowedContentTypes,
  defaults,
  url,
  checkpoint,
  method,
}: BuildFetchOptionsInput): SafeFetchOptions {
  const options: SafeFetchOptions = {
    allowedContentTypes: [...allowedContentTypes],
    maxBytes: boundFromConfig(ctx, 'maxBytes', defaults.maxBytes),
    timeoutMs: boundFromConfig(ctx, 'timeoutMs', defaults.timeoutMs),
    maxRedirects: boundFromConfig(ctx, 'maxRedirects', defaults.maxRedirects),
    respectRobots: ctx.config['respectRobots'] !== false,
  };

  if (method) options.method = method;

  const domainPolicy = domainPolicyFromConfig(ctx);
  if (domainPolicy) options.domainPolicy = domainPolicy;

  // Conditional GET (Req 26.3): pull ETag / Last-Modified for this URL.
  if (url && checkpoint) {
    const etag = checkpoint.etags?.[url];
    const lastModified = checkpoint.lastModified?.[url];
    if (etag !== undefined || lastModified !== undefined) {
      const conditional: { etag?: string; lastModified?: string } = {};
      if (etag !== undefined) conditional.etag = etag;
      if (lastModified !== undefined) conditional.lastModified = lastModified;
      options.conditional = conditional;
    }
  }

  return options;
}
