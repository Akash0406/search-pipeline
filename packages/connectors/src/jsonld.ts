/**
 * schema.org JobPosting JSON-LD extraction and mapping (Req 22, SRC-003).
 *
 * `extractJsonLdJobPostings` is a pure function over an HTML string: it finds
 * every `<script type="application/ld+json">` block, tolerantly parses each,
 * flattens `@graph`/array wrappers, and returns only nodes whose `@type` is
 * `JobPosting`. If a page has no valid JobPosting node the result is empty —
 * the connector then records a health issue and fabricates nothing (Req 22.2).
 */

import { parse as parseHtml } from 'node-html-parser';

import {
  structuredEvidence,
  structuredList,
} from './evidence.js';
import type { EvidenceValue, ParsedOpportunity, ParsedSalary } from './types.js';
import { cleanString, safeJsonParse, toIsoDate } from './util.js';

export type JsonLdNode = Record<string, unknown>;

/** Extract all schema.org JobPosting JSON-LD nodes from an HTML document. */
export function extractJsonLdJobPostings(html: string): JsonLdNode[] {
  const root = parseHtml(html, {
    lowerCaseTagName: true,
    comment: false,
  });
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');

  const nodes: JsonLdNode[] = [];
  for (const script of scripts) {
    const text = script.text?.trim() ?? script.rawText?.trim() ?? '';
    if (text.length === 0) continue;
    const parsed = safeJsonParse(text);
    if (parsed === undefined) continue;
    for (const node of flattenLdNodes(parsed)) {
      if (isJobPosting(node)) nodes.push(node);
    }
  }
  return nodes;
}

/** Flatten arrays and `@graph` wrappers into a flat list of object nodes. */
function flattenLdNodes(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) {
    return value.flatMap((v) => flattenLdNodes(v));
  }
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    const graph = node['@graph'];
    if (Array.isArray(graph)) {
      return graph.flatMap((v) => flattenLdNodes(v));
    }
    return [node];
  }
  return [];
}

/** True when a node declares `@type` (or an array of types) of `JobPosting`. */
export function isJobPosting(node: JsonLdNode): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type === 'JobPosting';
  if (Array.isArray(type)) return type.some((t) => t === 'JobPosting');
  return false;
}

/** Derive a stable external id for a JobPosting node. */
export function jobPostingExternalId(
  node: JsonLdNode,
  fallbackUrl: string,
): string {
  const identifier = extractIdentifier(node);
  if (identifier) return identifier;
  const url = cleanString(node['url']) ?? cleanString(fallbackUrl);
  if (url) return url;
  const title = cleanString(node['title']) ?? '';
  const org = extractOrganizationName(node) ?? '';
  return `${org}:${title}`.trim();
}

function extractIdentifier(node: JsonLdNode): string | undefined {
  const identifier = node['identifier'];
  if (typeof identifier === 'string') return cleanString(identifier);
  if (identifier && typeof identifier === 'object') {
    const value = (identifier as Record<string, unknown>)['value'];
    return cleanString(value) ?? cleanString((identifier as Record<string, unknown>)['name']);
  }
  return undefined;
}

function extractOrganizationName(node: JsonLdNode): string | undefined {
  const org = node['hiringOrganization'];
  if (typeof org === 'string') return cleanString(org);
  if (org && typeof org === 'object') {
    return cleanString((org as Record<string, unknown>)['name']);
  }
  return undefined;
}

/** Build a single location label from a schema.org jobLocation entry. */
function locationLabel(jobLocation: unknown): string | undefined {
  if (typeof jobLocation === 'string') return cleanString(jobLocation);
  if (!jobLocation || typeof jobLocation !== 'object') return undefined;

  const place = jobLocation as Record<string, unknown>;
  const address = place['address'];
  if (typeof address === 'string') return cleanString(address);
  if (!address || typeof address !== 'object') return cleanString(place['name']);

  const a = address as Record<string, unknown>;
  const parts = [
    cleanString(a['addressLocality']),
    cleanString(a['addressRegion']),
    cleanString(a['addressCountry']),
  ].filter((v): v is string => v !== undefined);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function extractLocations(node: JsonLdNode): string[] {
  const raw = node['jobLocation'];
  const entries = Array.isArray(raw) ? raw : [raw];
  const labels: string[] = [];
  for (const entry of entries) {
    const label = locationLabel(entry);
    if (label) labels.push(label);
  }
  return labels;
}

function extractWorkArrangement(node: JsonLdNode): string | undefined {
  const type = node['jobLocationType'];
  if (typeof type === 'string' && type.toUpperCase() === 'TELECOMMUTE') {
    return 'remote';
  }
  return undefined;
}

function extractEmploymentType(node: JsonLdNode): string | undefined {
  const value = node['employmentType'];
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
    return typeof first === 'string' ? cleanString(first) : undefined;
  }
  return undefined;
}

function extractSalary(node: JsonLdNode): ParsedSalary | undefined {
  const base = node['baseSalary'];
  if (!base || typeof base !== 'object') return undefined;
  const b = base as Record<string, unknown>;

  const currency = cleanString(b['currency']);
  const value = b['value'];
  const salary: ParsedSalary = {};
  if (currency) salary.currency = currency;

  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const min = toNumber(v['minValue']);
    const max = toNumber(v['maxValue']);
    const single = toNumber(v['value']);
    const unit = cleanString(v['unitText']);
    if (min !== undefined) salary.min = min;
    if (max !== undefined) salary.max = max;
    if (min === undefined && max === undefined && single !== undefined) {
      salary.min = single;
      salary.max = single;
    }
    if (unit) salary.period = unit.toLowerCase();
  } else {
    const single = toNumber(value);
    if (single !== undefined) {
      salary.min = single;
      salary.max = single;
    }
  }

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

function extractStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    // schema.org commonly comma/semicolon separates skills lists.
    return value
      .split(/[;,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  return [];
}

/**
 * Map a single schema.org JobPosting node into a {@link ParsedOpportunity}.
 * Every populated field carries `STRUCTURED_DATA` evidence; fields absent from
 * the node are omitted (never fabricated — Req 34.3/34.4).
 */
export function mapJsonLdJobPosting(
  node: JsonLdNode,
  rawArtifactId: string,
): ParsedOpportunity {
  const parsed: ParsedOpportunity = {};

  const title = structuredEvidence(cleanString(node['title']), rawArtifactId);
  if (title) parsed.title = title;

  const company = structuredEvidence(extractOrganizationName(node), rawArtifactId);
  if (company) parsed.company = company;

  const locations = structuredList(extractLocations(node), rawArtifactId);
  if (locations) parsed.locations = locations;

  const workArrangement = structuredEvidence(
    extractWorkArrangement(node),
    rawArtifactId,
  );
  if (workArrangement) parsed.workArrangement = workArrangement;

  const employmentType = structuredEvidence(
    extractEmploymentType(node),
    rawArtifactId,
  );
  if (employmentType) parsed.employmentType = employmentType;

  const postedAt = structuredEvidence(toIsoDate(node['datePosted']), rawArtifactId);
  if (postedAt) parsed.postedAt = postedAt;

  const closesAt = structuredEvidence(toIsoDate(node['validThrough']), rawArtifactId);
  if (closesAt) parsed.closesAt = closesAt;

  const descriptionHtml = structuredEvidence(
    cleanString(node['description']),
    rawArtifactId,
  );
  if (descriptionHtml) parsed.descriptionHtml = descriptionHtml;

  const url = cleanString(node['url']);
  const applyUrl = structuredEvidence(url, rawArtifactId);
  if (applyUrl) parsed.applyUrl = applyUrl;
  const canonicalUrlHint = structuredEvidence(url, rawArtifactId);
  if (canonicalUrlHint) parsed.canonicalUrlHint = canonicalUrlHint;

  const salary = extractSalary(node);
  const salaryEvidence: EvidenceValue<ParsedSalary> | undefined = salary
    ? structuredEvidence(salary, rawArtifactId, { sourceText: JSON.stringify(node['baseSalary']) })
    : undefined;
  if (salaryEvidence) parsed.salary = salaryEvidence;

  const skills = structuredList(extractStringList(node['skills']), rawArtifactId);
  if (skills) parsed.skills = skills;

  const requirements = structuredList(
    [
      ...extractStringList(node['qualifications']),
      ...extractStringList(node['experienceRequirements']),
      ...extractStringList(node['educationRequirements']),
    ],
    rawArtifactId,
  );
  if (requirements) parsed.requirements = requirements;

  return parsed;
}
