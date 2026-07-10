/**
 * ManualUrlConnector (Req 23, SRC-004) — single-URL submission.
 *
 * Fetches one user-submitted URL through the same SafeFetcher controls as
 * automated connectors (SSRF, size/timeout, content-type — Req 23.3). Parsing
 * prefers the JSON-LD JobPosting path; otherwise it falls back to best-effort
 * `PARSER` extraction from page metadata. On parse/validation failure the
 * connector returns an empty parse (never throws), so the pipeline keeps the
 * raw artifact and routes the record to the Review_Queue (Req 23.2) rather than
 * discarding data.
 *
 * `isFirstParty` is a conservative `false` here; the actual first-party flag is
 * resolved per source from the fetched domain (see {@link resolveFirstPartyFromUrl}).
 */

import { parse as parseHtml } from 'node-html-parser';

import { BaseConnector, requireStringConfig } from '../base-connector.js';
import { parserEvidence } from '../evidence.js';
import {
  DEFAULT_FETCH_BOUNDS,
  JSONLD_CONTENT_TYPES,
  buildFetchOptions,
} from '../fetch-options.js';
import {
  extractJsonLdJobPostings,
  isJobPosting,
  mapJsonLdJobPosting,
  type JsonLdNode,
} from '../jsonld.js';
import type {
  Checkpoint,
  ConnectorContext,
  DiscoveryRef,
  FetchResult,
  HealthStatus,
  ParsedOpportunity,
  SourceType,
} from '../types.js';
import {
  bodyText,
  cleanString,
  errorMessage,
  resolveRawArtifactId,
  safeJsonParse,
} from '../util.js';

/** Known first-party ATS hosts used to resolve `isFirstParty` per source. */
const FIRST_PARTY_HOST_SUFFIXES = [
  'greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
];

function submittedUrl(ctx: ConnectorContext): string {
  return requireStringConfig(ctx, 'url');
}

export class ManualUrlConnector extends BaseConnector {
  readonly sourceType: SourceType = 'manual_url';
  readonly isFirstParty = false;

  async *discover(
    ctx: ConnectorContext,
    _checkpoint: Checkpoint,
  ): AsyncIterable<DiscoveryRef> {
    const url = submittedUrl(ctx);
    yield {
      sourceType: this.sourceType,
      externalId: url,
      url,
      dedupKey: `manual_url:${url}`,
      discoveredAt: new Date().toISOString(),
    };
  }

  async fetch(
    ctx: ConnectorContext,
    ref: DiscoveryRef,
    checkpoint: Checkpoint,
  ): Promise<FetchResult> {
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSONLD_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.html,
      url: ref.url,
      checkpoint,
    });
    return ctx.fetcher.fetch(ref.url, options);
  }

  async parse(
    ctx: ConnectorContext,
    artifact: FetchResult,
  ): Promise<ParsedOpportunity> {
    const rawArtifactId = resolveRawArtifactId(ctx, artifact);
    const text = bodyText(artifact);

    // 1) Preferred: structured JSON-LD JobPosting (STRUCTURED_DATA evidence).
    const node = resolveJsonLdNode(text);
    if (node) return mapJsonLdJobPosting(node, rawArtifactId);

    // 2) Fallback: best-effort PARSER extraction from page metadata.
    //    Returns {} when nothing usable is found → pipeline routes to review.
    return parseHtmlBestEffort(text, artifact.finalUrl, rawArtifactId);
  }

  async healthCheck(ctx: ConnectorContext): Promise<HealthStatus> {
    let url: string;
    try {
      url = submittedUrl(ctx);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
    try {
      const result = await ctx.fetcher.fetch(
        url,
        buildFetchOptions({
          ctx,
          allowedContentTypes: JSONLD_CONTENT_TYPES,
          defaults: DEFAULT_FETCH_BOUNDS.html,
        }),
      );
      return result.status >= 200 && result.status < 400
        ? this.health('healthy', `fetched ${result.finalUrl}`)
        : this.health('degraded', `unexpected status ${result.status}`);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
  }
}

function resolveJsonLdNode(text: string): JsonLdNode | undefined {
  const nodes = extractJsonLdJobPostings(text);
  if (nodes[0]) return nodes[0];
  // The body may itself be a bare JSON-LD JobPosting document.
  const asJson = safeJsonParse(text);
  if (asJson && typeof asJson === 'object' && !Array.isArray(asJson)) {
    const node = asJson as JsonLdNode;
    if (isJobPosting(node)) return node;
  }
  return undefined;
}

/**
 * Best-effort extraction from generic HTML metadata. Only fields actually
 * present are populated, all with `PARSER` method and `uncertain: true`
 * (no-fabrication). Returns `{}` when not even a title can be found.
 */
export function parseHtmlBestEffort(
  html: string,
  finalUrl: string,
  rawArtifactId: string,
): ParsedOpportunity {
  const root = parseHtml(html, { lowerCaseTagName: true, comment: false });

  const metaContent = (selector: string): string | undefined =>
    cleanString(root.querySelector(selector)?.getAttribute('content'));

  const titleValue =
    metaContent('meta[property="og:title"]') ??
    cleanString(root.querySelector('title')?.text) ??
    cleanString(root.querySelector('h1')?.text);

  const companyValue = metaContent('meta[property="og:site_name"]');

  const descriptionValue =
    metaContent('meta[name="description"]') ??
    metaContent('meta[property="og:description"]');

  const canonicalValue =
    cleanString(root.querySelector('link[rel="canonical"]')?.getAttribute('href')) ??
    metaContent('meta[property="og:url"]') ??
    cleanString(finalUrl);

  const parsed: ParsedOpportunity = {};

  const title = parserEvidence(titleValue, rawArtifactId);
  if (title) parsed.title = title;

  const company = parserEvidence(companyValue, rawArtifactId);
  if (company) parsed.company = company;

  const descriptionHtml = parserEvidence(descriptionValue, rawArtifactId);
  if (descriptionHtml) parsed.descriptionHtml = descriptionHtml;

  const applyUrl = parserEvidence(canonicalValue, rawArtifactId);
  if (applyUrl) parsed.applyUrl = applyUrl;

  const canonicalUrlHint = parserEvidence(canonicalValue, rawArtifactId);
  if (canonicalUrlHint) parsed.canonicalUrlHint = canonicalUrlHint;

  return parsed;
}

/**
 * Resolve whether a fetched URL belongs to a first-party source, based on its
 * host. Used by the pipeline to set the per-source `isFirstParty` flag for
 * manually submitted URLs (SRC-004). Defaults to `false`.
 */
export function resolveFirstPartyFromUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return FIRST_PARTY_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}
