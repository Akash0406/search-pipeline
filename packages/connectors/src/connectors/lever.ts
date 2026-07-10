/**
 * LeverConnector (Req 21, SRC-002) — first-party ATS connector over the
 * official public postings JSON API. Unauthenticated public GETs only; no
 * credentials/passwords are collected (Req 21.5, 28).
 *
 * Endpoints:
 *  - list:   https://api.lever.co/v0/postings/{slug}?mode=json
 *  - detail: https://api.lever.co/v0/postings/{slug}/{id}?mode=json
 */

import {
  BaseConnector,
  optionalStringConfig,
  requireStringConfig,
} from '../base-connector.js';
import { structuredEvidence, structuredList } from '../evidence.js';
import {
  DEFAULT_FETCH_BOUNDS,
  JSON_CONTENT_TYPES,
  buildFetchOptions,
} from '../fetch-options.js';
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
  cleanString,
  errorMessage,
  parseJsonBody,
  resolveRawArtifactId,
  toIsoDate,
} from '../util.js';

const BASE_URL = 'https://api.lever.co/v0/postings';

interface LeverCategories {
  location?: string;
  team?: string;
  department?: string;
  commitment?: string;
  allLocations?: string[];
}

interface LeverPosting {
  id?: string;
  text?: string;
  categories?: LeverCategories;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number | string;
  description?: string;
  descriptionPlain?: string;
  workplaceType?: string;
  country?: string;
}

export class LeverConnector extends BaseConnector {
  readonly sourceType: SourceType = 'lever';
  readonly isFirstParty = true;

  private listUrl(slug: string): string {
    return `${BASE_URL}/${encodeURIComponent(slug)}?mode=json`;
  }

  private detailUrl(slug: string, id: string): string {
    return `${BASE_URL}/${encodeURIComponent(slug)}/${encodeURIComponent(id)}?mode=json`;
  }

  async *discover(
    ctx: ConnectorContext,
    checkpoint: Checkpoint,
  ): AsyncIterable<DiscoveryRef> {
    const slug = requireStringConfig(ctx, 'slug');
    const url = this.listUrl(slug);
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSON_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.json,
      url,
      checkpoint,
    });

    const result = await ctx.fetcher.fetch(url, options);
    const postings = parseJsonBody<LeverPosting[]>(result) ?? [];
    const discoveredAt = new Date().toISOString();

    for (const posting of postings) {
      if (ctx.signal.aborted) return;
      const id = cleanString(posting.id);
      if (!id) continue;

      const hints: Record<string, string> = {};
      const hosted = cleanString(posting.hostedUrl);
      if (hosted) hints['hostedUrl'] = hosted;
      const title = cleanString(posting.text);
      if (title) hints['title'] = title;

      yield {
        sourceType: this.sourceType,
        externalId: id,
        url: this.detailUrl(slug, id),
        dedupKey: `lever:${slug}:${id}`,
        discoveredAt,
        ...(Object.keys(hints).length > 0 ? { hints } : {}),
      };
    }
  }

  async fetch(
    ctx: ConnectorContext,
    ref: DiscoveryRef,
    checkpoint: Checkpoint,
  ): Promise<FetchResult> {
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSON_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.json,
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
    // The detail endpoint may return the single posting or a single-element
    // array depending on the request; normalise to one object.
    const body = parseJsonBody<LeverPosting | LeverPosting[]>(artifact);
    const posting = Array.isArray(body) ? body[0] : body;
    return mapLeverPosting(posting ?? {}, rawArtifactId);
  }

  async healthCheck(ctx: ConnectorContext): Promise<HealthStatus> {
    const slug = optionalStringConfig(ctx, 'slug');
    if (!slug) return this.health('failing', 'missing board slug config');
    const url = this.listUrl(slug);
    try {
      const result = await ctx.fetcher.fetch(
        url,
        buildFetchOptions({
          ctx,
          allowedContentTypes: JSON_CONTENT_TYPES,
          defaults: DEFAULT_FETCH_BOUNDS.json,
        }),
      );
      const postings = parseJsonBody<LeverPosting[]>(result);
      if (!Array.isArray(postings)) {
        return this.health('degraded', 'unexpected postings response shape');
      }
      return this.health('healthy', `${postings.length} postings on board`);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
  }
}

/**
 * Pure mapper: Lever posting JSON → {@link ParsedOpportunity} with
 * `STRUCTURED_DATA` evidence. Absent fields are omitted (Req 34.3).
 */
export function mapLeverPosting(
  posting: LeverPosting,
  rawArtifactId: string,
): ParsedOpportunity {
  const parsed: ParsedOpportunity = {};
  const categories = posting.categories ?? {};

  const title = structuredEvidence(cleanString(posting.text), rawArtifactId);
  if (title) parsed.title = title;

  const locationValues =
    categories.allLocations && categories.allLocations.length > 0
      ? categories.allLocations
      : [categories.location];
  const locations = structuredList(locationValues, rawArtifactId);
  if (locations) parsed.locations = locations;

  const workArrangement = structuredEvidence(
    cleanString(posting.workplaceType),
    rawArtifactId,
  );
  if (workArrangement) parsed.workArrangement = workArrangement;

  const employmentType = structuredEvidence(
    cleanString(categories.commitment),
    rawArtifactId,
  );
  if (employmentType) parsed.employmentType = employmentType;

  const postedAt = structuredEvidence(toIsoDate(posting.createdAt), rawArtifactId);
  if (postedAt) parsed.postedAt = postedAt;

  const description = cleanString(posting.description);
  const descriptionHtml = structuredEvidence(description, rawArtifactId);
  if (descriptionHtml) parsed.descriptionHtml = descriptionHtml;

  const applyUrl = structuredEvidence(
    cleanString(posting.applyUrl) ?? cleanString(posting.hostedUrl),
    rawArtifactId,
  );
  if (applyUrl) parsed.applyUrl = applyUrl;

  const canonicalUrlHint = structuredEvidence(
    cleanString(posting.hostedUrl),
    rawArtifactId,
  );
  if (canonicalUrlHint) parsed.canonicalUrlHint = canonicalUrlHint;

  return parsed;
}
