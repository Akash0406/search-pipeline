/**
 * JsonLdConnector (Req 22, SRC-003) — first-party connector for company career
 * pages that publish schema.org JobPosting JSON-LD.
 *
 * `discover` fetches the page and yields one ref per JobPosting node. If a page
 * has NO valid JobPosting JSON-LD, discovery yields ZERO refs and `healthCheck`
 * reports the issue ("no valid JobPosting JSON-LD found") — nothing is ever
 * fabricated (Req 22.2). `fetch` narrows the page down to the single JSON-LD
 * node so `parse` maps exactly one posting.
 */

import { BaseConnector, optionalStringConfig } from '../base-connector.js';
import {
  DEFAULT_FETCH_BOUNDS,
  JSONLD_CONTENT_TYPES,
  buildFetchOptions,
} from '../fetch-options.js';
import {
  extractJsonLdJobPostings,
  isJobPosting,
  jobPostingExternalId,
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
  syntheticJsonArtifact,
} from '../util.js';

export const JSONLD_NO_POSTING_MESSAGE = 'no valid JobPosting JSON-LD found';

/** Read the career-page URL from `url` (preferred) or `pageUrl`. */
function pageUrl(ctx: ConnectorContext): string {
  const url = optionalStringConfig(ctx, 'url') ?? optionalStringConfig(ctx, 'pageUrl');
  if (!url) {
    throw new Error('Connector config "url" is required (career page URL)');
  }
  return url;
}

export class JsonLdConnector extends BaseConnector {
  readonly sourceType: SourceType = 'jsonld';
  readonly isFirstParty = true;

  async *discover(
    ctx: ConnectorContext,
    checkpoint: Checkpoint,
  ): AsyncIterable<DiscoveryRef> {
    const url = pageUrl(ctx);
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSONLD_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.html,
      url,
      checkpoint,
    });

    const result = await ctx.fetcher.fetch(url, options);
    const nodes = extractJsonLdJobPostings(bodyText(result));

    if (nodes.length === 0) {
      // Fabricate nothing (Req 22.2): zero refs; health is surfaced separately.
      ctx.logger.warn('connector.jsonld.no_posting', {
        connectionId: ctx.connectionId,
        sourceType: this.sourceType,
        outcome: 'skipped',
      });
      return;
    }

    const discoveredAt = new Date().toISOString();
    for (const node of nodes) {
      if (ctx.signal.aborted) return;
      const externalId = jobPostingExternalId(node, url);
      const nodeUrl = cleanString(node['url']) ?? url;
      yield {
        sourceType: this.sourceType,
        externalId,
        url: nodeUrl,
        dedupKey: `jsonld:${externalId}`,
        discoveredAt,
        hints: { pageUrl: url },
      };
    }
  }

  async fetch(
    ctx: ConnectorContext,
    ref: DiscoveryRef,
    checkpoint: Checkpoint,
  ): Promise<FetchResult> {
    const url = cleanString(ref.hints?.['pageUrl']) ?? pageUrl(ctx);
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSONLD_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.html,
      url,
      checkpoint,
    });

    const result = await ctx.fetcher.fetch(url, options);
    if (result.notModified) return result;

    const nodes = extractJsonLdJobPostings(bodyText(result));
    const node =
      nodes.find((n) => jobPostingExternalId(n, url) === ref.externalId) ??
      nodes[0];
    // Narrow to a single JSON-LD node so parse maps exactly one posting.
    return node ? syntheticJsonArtifact(node, result) : result;
  }

  async parse(
    ctx: ConnectorContext,
    artifact: FetchResult,
  ): Promise<ParsedOpportunity> {
    const rawArtifactId = resolveRawArtifactId(ctx, artifact);
    const node = resolveNode(artifact);
    // No valid JobPosting → empty ParsedOpportunity (zero opportunity data).
    return node ? mapJsonLdJobPosting(node, rawArtifactId) : {};
  }

  async healthCheck(ctx: ConnectorContext): Promise<HealthStatus> {
    let url: string;
    try {
      url = pageUrl(ctx);
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
      const nodes = extractJsonLdJobPostings(bodyText(result));
      if (nodes.length === 0) {
        return this.health('degraded', JSONLD_NO_POSTING_MESSAGE);
      }
      return this.health('healthy', `${nodes.length} JobPosting node(s) found`);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
  }
}

/**
 * Resolve the single JobPosting node from an artifact that is either a narrowed
 * JSON-LD node (from {@link JsonLdConnector.fetch}) or a raw HTML page.
 */
function resolveNode(artifact: FetchResult): JsonLdNode | undefined {
  const text = bodyText(artifact);
  const asJson = safeJsonParse(text);
  if (asJson && typeof asJson === 'object' && !Array.isArray(asJson)) {
    const node = asJson as JsonLdNode;
    if (isJobPosting(node)) return node;
  }
  const nodes = extractJsonLdJobPostings(text);
  return nodes[0];
}
