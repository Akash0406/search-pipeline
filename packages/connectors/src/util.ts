/**
 * Small pure utilities shared by the connectors: body decoding, safe JSON,
 * HTML-entity decoding, date coercion, and synthetic {@link FetchResult}
 * construction (used when a connector narrows a multi-item payload down to a
 * single-opportunity artifact).
 */

import { createHash } from 'node:crypto';

import type { ConnectorContext, FetchResult, ParsedOpportunity } from './types.js';

/** Decode a fetch-result body to a UTF-8 string. */
export function bodyText(artifact: FetchResult): string {
  return artifact.body.toString('utf8');
}

/** Parse a fetch-result body as JSON, returning `undefined` on failure. */
export function parseJsonBody<T = unknown>(artifact: FetchResult): T | undefined {
  return safeJsonParse<T>(bodyText(artifact));
}

/** Parse JSON text, returning `undefined` instead of throwing. */
export function safeJsonParse<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  '#39': "'",
};

/**
 * Decode the common HTML entities found in ATS `content` fields (Greenhouse
 * returns HTML-escaped markup). Handles named entities plus decimal/hex numeric
 * references. Not a full HTML entity table — sanitization happens downstream.
 */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : safeFromCodePoint(code, match);
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : safeFromCodePoint(code, match);
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? match;
  });
}

function safeFromCodePoint(code: number, fallback: string): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * Coerce a source date value into an ISO-8601 string, or `undefined` when it
 * cannot be interpreted (never fabricate a date). Accepts ISO strings, epoch
 * milliseconds (number or numeric string), and `Date`.
 */
export function toIsoDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    // Numeric string → treat as epoch milliseconds.
    if (/^\d{10,}$/.test(trimmed)) {
      const d = new Date(Number.parseInt(trimmed, 10));
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

/** Trim to a non-empty string, or return `undefined`. */
export function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Build an in-memory {@link FetchResult} for a value derived from an already
 * fetched payload (e.g. one job sliced out of a board list, or one JSON-LD node
 * extracted from a page). No network access occurs.
 */
export function syntheticJsonArtifact(value: unknown, source: FetchResult): FetchResult {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  return {
    finalUrl: source.finalUrl,
    status: source.status,
    notModified: false,
    headers: source.headers,
    contentType: 'application/json',
    body,
    byteSize: body.byteLength,
    ...(source.etag !== undefined ? { etag: source.etag } : {}),
    ...(source.lastModified !== undefined ? { lastModified: source.lastModified } : {}),
  };
}

/**
 * Resolve the Raw_Artifact reference that evidence records point at (OPP-003.1).
 *
 * The ingestion pipeline stores the artifact first and injects its id via
 * `ctx.config.rawArtifactId`. When that is absent (e.g. ad-hoc parsing/tests),
 * fall back to a deterministic content-addressable id derived from the final
 * URL and body — mirroring the `raw_artifacts` content-hash identity.
 */
export function resolveRawArtifactId(ctx: ConnectorContext, artifact: FetchResult): string {
  const injected = ctx.config['rawArtifactId'];
  if (typeof injected === 'string' && injected.trim().length > 0) {
    return injected.trim();
  }
  const hash = createHash('sha256');
  hash.update(artifact.finalUrl);
  hash.update('\n');
  hash.update(artifact.body);
  return `sha256:${hash.digest('hex')}`;
}

/** Extract a safe message string from an unknown thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A parsed opportunity is "empty" (unusable) when it carries neither a title
 * nor a description. The ingestion pipeline uses this to route a record to the
 * Review_Queue while retaining the raw artifact (Req 23.2, 35.1).
 */
export function isParsedOpportunityEmpty(parsed: ParsedOpportunity): boolean {
  return parsed.title === undefined && parsed.descriptionHtml === undefined;
}
