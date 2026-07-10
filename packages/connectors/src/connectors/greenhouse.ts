/**
 * GreenhouseConnector (Req 21, SRC-002) — first-party ATS connector over the
 * official public boards JSON API. No credentials/passwords are ever collected
 * (Req 21.5, 28): every request is an unauthenticated public GET through the
 * injected SafeFetcher.
 *
 * Endpoints:
 *  - list:   https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *  - detail: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}
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
  decodeHtmlEntities,
  errorMessage,
  parseJsonBody,
  resolveRawArtifactId,
  toIsoDate,
} from '../util.js';

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  updated_at?: string;
  first_published?: string;
  absolute_url?: string;
  location?: { name?: string };
  content?: string;
  company_name?: string;
}

interface GreenhouseList {
  jobs?: GreenhouseJob[];
}

export class GreenhouseConnector extends BaseConnector {
  readonly sourceType: SourceType = 'greenhouse';
  readonly isFirstParty = true;

  private listUrl(slug: string): string {
    return `${BASE_URL}/${encodeURIComponent(slug)}/jobs?content=true`;
  }

  private detailUrl(slug: string, id: string): string {
    return `${BASE_URL}/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`;
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
    // The Greenhouse boards API returns the full board in one response.
    const list = parseJsonBody<GreenhouseList>(result);
    const jobs = list?.jobs ?? [];
    const discoveredAt = new Date().toISOString();

    for (const job of jobs) {
      if (ctx.signal.aborted) return;
      const id = cleanString(job.id !== undefined ? String(job.id) : undefined);
      if (!id) continue;

      const hints: Record<string, string> = {};
      const absolute = cleanString(job.absolute_url);
      if (absolute) hints['absoluteUrl'] = absolute;
      const updated = cleanString(job.updated_at);
      if (updated) hints['updatedAt'] = updated;
      const title = cleanString(job.title);
      if (title) hints['title'] = title;

      yield {
        sourceType: this.sourceType,
        externalId: id,
        url: this.detailUrl(slug, id),
        dedupKey: `greenhouse:${slug}:${id}`,
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
    const job = parseJsonBody<GreenhouseJob>(artifact) ?? {};
    return mapGreenhouseJob(job, rawArtifactId);
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
      const list = parseJsonBody<GreenhouseList>(result);
      if (!list || !Array.isArray(list.jobs)) {
        return this.health('degraded', 'unexpected board response shape');
      }
      return this.health('healthy', `${list.jobs.length} jobs on board`);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
  }
}

/**
 * Pure mapper: Greenhouse job JSON → {@link ParsedOpportunity} with
 * `STRUCTURED_DATA` evidence. Fields Greenhouse does not publish (salary,
 * employment type, seniority) are omitted rather than fabricated (Req 34.3).
 */
export function mapGreenhouseJob(
  job: GreenhouseJob,
  rawArtifactId: string,
): ParsedOpportunity {
  const parsed: ParsedOpportunity = {};

  const title = structuredEvidence(cleanString(job.title), rawArtifactId);
  if (title) parsed.title = title;

  const company = structuredEvidence(cleanString(job.company_name), rawArtifactId);
  if (company) parsed.company = company;

  const locations = structuredList([cleanString(job.location?.name)], rawArtifactId);
  if (locations) parsed.locations = locations;

  // `first_published` is a genuine posting date; `updated_at` is NOT a posting
  // date, so we never map it to `postedAt` (no-fabrication).
  const postedAt = structuredEvidence(toIsoDate(job.first_published), rawArtifactId);
  if (postedAt) parsed.postedAt = postedAt;

  const content = cleanString(job.content);
  const descriptionHtml = structuredEvidence(
    content ? decodeHtmlEntities(content) : undefined,
    rawArtifactId,
    content ? { sourceText: content } : undefined,
  );
  if (descriptionHtml) parsed.descriptionHtml = descriptionHtml;

  const absolute = cleanString(job.absolute_url);
  const applyUrl = structuredEvidence(absolute, rawArtifactId);
  if (applyUrl) parsed.applyUrl = applyUrl;
  const canonicalUrlHint = structuredEvidence(absolute, rawArtifactId);
  if (canonicalUrlHint) parsed.canonicalUrlHint = canonicalUrlHint;

  return parsed;
}
