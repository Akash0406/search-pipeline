/**
 * Canonical content hashing + field diffing for change detection (Req 39).
 *
 * A stable hash over the canonical fields lets the pipeline decide whether a
 * re-fetched posting actually changed. When it did, {@link diffCanonicalFields}
 * lists which canonical fields differ so a `content_revisions` row can record
 * them (Req 39.2) and `opportunities.last_updated_at` can advance (Req 39.3).
 */

import { createHash } from 'node:crypto';
import type { CanonicalCandidate } from '@careerstack/shared';
import type { schema } from '@careerstack/database';

type OpportunityRow = typeof schema.opportunities.$inferSelect;

/** The canonical fields that participate in content-change detection. */
export interface CanonicalSnapshot {
  title: string;
  company: string;
  canonicalUrl: string;
  applyUrl: string;
  workArrangement: string;
  employmentType: string;
  seniority: string;
  salary: string;
  locations: string;
  closingAt: string;
  description: string;
}

/** Project a normalized candidate into a comparable snapshot. */
export function snapshotFromCandidate(candidate: CanonicalCandidate): CanonicalSnapshot {
  const salary = candidate.salary
    ? `${candidate.salary.min ?? ''}|${candidate.salary.max ?? ''}|${candidate.salary.currency ?? ''}|${candidate.salary.period ?? ''}`
    : '';
  return {
    title: candidate.title,
    company: candidate.company,
    canonicalUrl: candidate.canonicalUrl,
    applyUrl: candidate.applyUrl ?? '',
    workArrangement: candidate.workArrangement ?? '',
    employmentType: candidate.employmentType ?? '',
    seniority: candidate.seniority ?? '',
    salary,
    locations: [...candidate.locationStrings].sort().join('||'),
    closingAt: candidate.closingAt ?? '',
    description: candidate.description ?? '',
  };
}

/** Deterministic sha256 over a snapshot (stable key order). */
export function hashSnapshot(snapshot: CanonicalSnapshot): string {
  const ordered = Object.keys(snapshot)
    .sort()
    .map((k) => `${k}=${snapshot[k as keyof CanonicalSnapshot]}`)
    .join('\n');
  return createHash('sha256').update(ordered).digest('hex');
}

/** Convenience: hash a candidate's canonical content directly. */
export function canonicalContentHash(candidate: CanonicalCandidate): string {
  return hashSnapshot(snapshotFromCandidate(candidate));
}

/**
 * Compare a stored opportunity row to a new candidate snapshot and return the
 * names of the canonical fields that changed (Req 39.2). Only fields that map
 * onto a stored column are compared.
 */
export function diffCanonicalFields(
  previous: OpportunityRow,
  next: CanonicalSnapshot,
): string[] {
  const prev: Partial<Record<keyof CanonicalSnapshot, string>> = {
    title: previous.title,
    company: previous.company,
    canonicalUrl: previous.canonicalUrl ?? '',
    applyUrl: previous.applyUrl ?? '',
    workArrangement: previous.workArrangement ?? '',
    employmentType: previous.employmentType ?? '',
    seniority: previous.seniority ?? '',
    closingAt: previous.closingAt ? previous.closingAt.toISOString() : '',
    salary: `${previous.salaryMin ?? ''}|${previous.salaryMax ?? ''}|${previous.salaryCurrency ?? ''}|${previous.salaryPeriod ?? ''}`,
  };
  const changed: string[] = [];
  for (const key of Object.keys(prev) as (keyof CanonicalSnapshot)[]) {
    if (prev[key] !== next[key]) changed.push(key);
  }
  return changed.sort();
}
