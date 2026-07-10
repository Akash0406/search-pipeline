/**
 * AshbyConnector (Req 21, SRC-002) — first-party ATS connector over the
 * official public job-board API. Unauthenticated public GETs only; no
 * credentials/passwords are collected (Req 21.5, 28).
 *
 * The public API returns the whole board in one response, so `discover` yields
 * one ref per job and `fetch` narrows the board payload down to the single job
 * (a one-artifact-per-opportunity {@link FetchResult}) so `parse` maps exactly
 * one posting.
 *
 * Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
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
  ParsedSalary,
  SourceType,
} from '../types.js';
import {
  cleanString,
  errorMessage,
  parseJsonBody,
  resolveRawArtifactId,
  syntheticJsonArtifact,
  toIsoDate,
} from '../util.js';

const BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';

interface AshbySecondaryLocation {
  location?: string;
}

interface AshbyCompensationComponent {
  minValue?: number | string;
  maxValue?: number | string;
  currencyCode?: string;
  interval?: string;
}

interface AshbyCompensation {
  summaryComponents?: AshbyCompensationComponent[];
}

interface AshbyJob {
  id?: string;
  title?: string;
  location?: string;
  secondaryLocations?: AshbySecondaryLocation[];
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  isListed?: boolean;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: AshbyCompensation;
}

interface AshbyBoard {
  jobs?: AshbyJob[];
}

export class AshbyConnector extends BaseConnector {
  readonly sourceType: SourceType = 'ashby';
  readonly isFirstParty = true;

  private boardUrl(slug: string): string {
    return `${BASE_URL}/${encodeURIComponent(slug)}?includeCompensation=true`;
  }

  async *discover(
    ctx: ConnectorContext,
    checkpoint: Checkpoint,
  ): AsyncIterable<DiscoveryRef> {
    const slug = requireStringConfig(ctx, 'slug');
    const url = this.boardUrl(slug);
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSON_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.json,
      url,
      checkpoint,
    });

    const result = await ctx.fetcher.fetch(url, options);
    const board = parseJsonBody<AshbyBoard>(result);
    const jobs = board?.jobs ?? [];
    const discoveredAt = new Date().toISOString();

    for (const job of jobs) {
      if (ctx.signal.aborted) return;
      // Unlisted roles must not appear on a public board.
      if (job.isListed === false) continue;
      const id = cleanString(job.id);
      if (!id) continue;

      const jobUrl = cleanString(job.jobUrl);
      const hints: Record<string, string> = {};
      if (jobUrl) hints['jobUrl'] = jobUrl;
      const title = cleanString(job.title);
      if (title) hints['title'] = title;

      yield {
        sourceType: this.sourceType,
        externalId: id,
        url: jobUrl ?? url,
        dedupKey: `ashby:${slug}:${id}`,
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
    const slug = requireStringConfig(ctx, 'slug');
    const boardUrl = this.boardUrl(slug);
    const options = buildFetchOptions({
      ctx,
      allowedContentTypes: JSON_CONTENT_TYPES,
      defaults: DEFAULT_FETCH_BOUNDS.json,
      url: boardUrl,
      checkpoint,
    });

    const result = await ctx.fetcher.fetch(boardUrl, options);
    if (result.notModified) return result;

    const board = parseJsonBody<AshbyBoard>(result);
    const job = board?.jobs?.find((j) => cleanString(j.id) === ref.externalId);
    // Narrow to the single posting so the stored artifact maps 1:1 to one
    // opportunity. If not found, pass the board through (parse yields empty).
    return job ? syntheticJsonArtifact(job, result) : result;
  }

  async parse(
    ctx: ConnectorContext,
    artifact: FetchResult,
  ): Promise<ParsedOpportunity> {
    const rawArtifactId = resolveRawArtifactId(ctx, artifact);
    const job = parseJsonBody<AshbyJob>(artifact) ?? {};
    const company = optionalStringConfig(ctx, 'company');
    return mapAshbyJob(job, rawArtifactId, company ? { company } : undefined);
  }

  async healthCheck(ctx: ConnectorContext): Promise<HealthStatus> {
    const slug = optionalStringConfig(ctx, 'slug');
    if (!slug) return this.health('failing', 'missing board slug config');
    const url = this.boardUrl(slug);
    try {
      const result = await ctx.fetcher.fetch(
        url,
        buildFetchOptions({
          ctx,
          allowedContentTypes: JSON_CONTENT_TYPES,
          defaults: DEFAULT_FETCH_BOUNDS.json,
        }),
      );
      const board = parseJsonBody<AshbyBoard>(result);
      if (!board || !Array.isArray(board.jobs)) {
        return this.health('degraded', 'unexpected board response shape');
      }
      return this.health('healthy', `${board.jobs.length} jobs on board`);
    } catch (error) {
      return this.health('failing', errorMessage(error));
    }
  }
}

/**
 * Pure mapper: Ashby job JSON → {@link ParsedOpportunity} with
 * `STRUCTURED_DATA` evidence. Absent fields are omitted (Req 34.3). The org
 * name is not carried per-job by the public API, so `company` is supplied from
 * connection config when available rather than guessed.
 */
export function mapAshbyJob(
  job: AshbyJob,
  rawArtifactId: string,
  opts?: { company?: string },
): ParsedOpportunity {
  const parsed: ParsedOpportunity = {};

  const title = structuredEvidence(cleanString(job.title), rawArtifactId);
  if (title) parsed.title = title;

  const company = structuredEvidence(cleanString(opts?.company), rawArtifactId, {
    confidence: 0.8,
  });
  if (company) parsed.company = company;

  const locationValues = [
    cleanString(job.location),
    ...(job.secondaryLocations ?? []).map((s) => cleanString(s.location)),
  ];
  const locations = structuredList(locationValues, rawArtifactId);
  if (locations) parsed.locations = locations;

  const workArrangementValue =
    cleanString(job.workplaceType) ?? (job.isRemote === true ? 'remote' : undefined);
  const workArrangement = structuredEvidence(workArrangementValue, rawArtifactId);
  if (workArrangement) parsed.workArrangement = workArrangement;

  const employmentType = structuredEvidence(
    cleanString(job.employmentType),
    rawArtifactId,
  );
  if (employmentType) parsed.employmentType = employmentType;

  const postedAt = structuredEvidence(toIsoDate(job.publishedAt), rawArtifactId);
  if (postedAt) parsed.postedAt = postedAt;

  const descriptionHtml = structuredEvidence(
    cleanString(job.descriptionHtml),
    rawArtifactId,
  );
  if (descriptionHtml) parsed.descriptionHtml = descriptionHtml;

  const applyUrl = structuredEvidence(
    cleanString(job.applyUrl) ?? cleanString(job.jobUrl),
    rawArtifactId,
  );
  if (applyUrl) parsed.applyUrl = applyUrl;

  const canonicalUrlHint = structuredEvidence(cleanString(job.jobUrl), rawArtifactId);
  if (canonicalUrlHint) parsed.canonicalUrlHint = canonicalUrlHint;

  const salary = extractAshbySalary(job.compensation);
  if (salary) {
    const salaryEvidence = structuredEvidence(salary, rawArtifactId, {
      sourceText: JSON.stringify(job.compensation),
    });
    if (salaryEvidence) parsed.salary = salaryEvidence;
  }

  return parsed;
}

function extractAshbySalary(
  compensation: AshbyCompensation | undefined,
): ParsedSalary | undefined {
  const component = compensation?.summaryComponents?.find(
    (c) => c.minValue !== undefined || c.maxValue !== undefined,
  );
  if (!component) return undefined;

  const salary: ParsedSalary = {};
  const min = toNumber(component.minValue);
  const max = toNumber(component.maxValue);
  const currency = cleanString(component.currencyCode);
  const interval = cleanString(component.interval);
  if (min !== undefined) salary.min = min;
  if (max !== undefined) salary.max = max;
  if (currency) salary.currency = currency;
  if (interval) salary.period = interval.toLowerCase();

  return Object.keys(salary).length > 0 ? salary : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
