/**
 * Human-facing labels + formatting helpers for the opportunity explorer and
 * detail views (Req 40–46). Enum values mirror `@careerstack/contracts` exactly;
 * labels are the display strings shown to users. Kept framework-free so both
 * server and client components can reuse them.
 */
import type {
  EmploymentType,
  ExplorerFreshness,
  ExplorerSortKey,
  ExplorerStateFilter,
  ExtractionMethod,
  SalaryRange,
  Seniority,
  SourceType,
  WorkArrangement,
} from '@careerstack/contracts';

/** Sort options in display order (Req 42.1). */
export const SORT_OPTIONS: ReadonlyArray<{ value: ExplorerSortKey; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'newlyDiscovered', label: 'Newly discovered' },
  { value: 'closingSoon', label: 'Closing soon' },
  { value: 'recentlyUpdated', label: 'Recently updated' },
];

/** Default sort applied when the URL carries no explicit sort (Req 42.2). */
export const DEFAULT_SORT: ExplorerSortKey = 'newest';

export const WORK_ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  on_site: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
  executive: 'Executive',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  jsonld: 'Structured data (JSON-LD)',
  manual_url: 'Manual URL',
  gmail: 'Gmail',
};

export const STATE_FILTER_LABELS: Record<ExplorerStateFilter, string> = {
  saved: 'Saved',
  dismissed: 'Dismissed',
  needsReview: 'Needs review',
};

export const FRESHNESS_LABELS: Record<ExplorerFreshness, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/** How a fact was extracted — shown alongside per-fact evidence (Req 45.2). */
export const EXTRACTION_METHOD_LABELS: Record<ExtractionMethod, string> = {
  STRUCTURED_DATA: 'Structured data',
  RULE: 'Rule',
  PARSER: 'Parser',
  LLM: 'AI extraction',
  USER: 'User-provided',
};

/** Options list built from a label record, preserving key order. */
export function toOptions<T extends string>(
  labels: Record<T, string>,
): ReadonlyArray<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const WORK_ARRANGEMENT_OPTIONS = toOptions(WORK_ARRANGEMENT_LABELS);
export const EMPLOYMENT_TYPE_OPTIONS = toOptions(EMPLOYMENT_TYPE_LABELS);
export const SENIORITY_OPTIONS = toOptions(SENIORITY_LABELS);
export const STATE_FILTER_OPTIONS = toOptions(STATE_FILTER_LABELS);
export const FRESHNESS_OPTIONS = toOptions(FRESHNESS_LABELS);

/** Source options excluding `gmail` (reserved for a future spec, never built). */
export const SOURCE_TYPE_OPTIONS = toOptions(SOURCE_TYPE_LABELS).filter((o) => o.value !== 'gmail');

/**
 * Format a salary range using the source-provided currency/period, only when a
 * value is actually present (Req OPP-003.3 — never fabricate). Returns
 * `undefined` when there is nothing meaningful to show.
 */
export function formatSalary(salary: SalaryRange | undefined): string | undefined {
  if (!salary) return undefined;
  const { min, max, currency, period } = salary;
  if (min === undefined && max === undefined) return undefined;

  const fmt = (value: number): string => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: currency ? 'currency' : 'decimal',
        currency: currency || undefined,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return String(value);
    }
  };

  const periodSuffix = period ? `/${period}` : '';
  if (min !== undefined && max !== undefined) {
    return min === max ? `${fmt(min)}${periodSuffix}` : `${fmt(min)} – ${fmt(max)}${periodSuffix}`;
  }
  const value = (min ?? max) as number;
  const prefix = min !== undefined ? 'From ' : 'Up to ';
  return `${prefix}${fmt(value)}${periodSuffix}`;
}

/** Compact "City · Remote" style location summary for list rows/cards. */
export function formatLocations(locations: readonly string[]): string | undefined {
  if (locations.length === 0) return undefined;
  if (locations.length <= 2) return locations.join(' · ');
  return `${locations.slice(0, 2).join(' · ')} +${locations.length - 2}`;
}
