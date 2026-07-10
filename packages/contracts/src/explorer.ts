/**
 * Pure explorer filter/sort state + a round-trippable URL codec.
 *
 * Requirements: 41.1–41.4 (filter dimensions), 42.1 (sort keys),
 * 44.1/44.3 (URL state encodes ONLY filter/sort params, never private state).
 * Correctness Property 22: `decode(encode(s)) === s`.
 *
 * This module is intentionally framework-agnostic and side-effect free. It uses
 * the platform `URLSearchParams` for a canonical, symmetric wire format.
 *
 * Design: API §7 (filter/sort), Frontend §8 (URL state).
 */
import { z } from 'zod';
import {
  employmentTypeSchema,
  senioritySchema,
  sourceTypeSchema,
  workArrangementSchema,
} from './common/enums.js';

/** Sort keys (Req 42.1). */
export const explorerSortKeySchema = z.enum([
  'newest',
  'newlyDiscovered',
  'closingSoon',
  'recentlyUpdated',
]);
export type ExplorerSortKey = z.infer<typeof explorerSortKeySchema>;

/** Per-user state filter (Req 41.3). */
export const explorerStateFilterSchema = z.enum([
  'saved',
  'dismissed',
  'needsReview',
]);
export type ExplorerStateFilter = z.infer<typeof explorerStateFilterSchema>;

/** Freshness window filter (Req 41.4). */
export const explorerFreshnessSchema = z.enum(['24h', '7d', '30d', '90d']);
export type ExplorerFreshness = z.infer<typeof explorerFreshnessSchema>;

/**
 * Per-field schemas for every filter/sort dimension. This map is the single
 * source of truth for BOTH the aggregate {@link explorerStateSchema} and the
 * codec below, guaranteeing the encoder/decoder can never drift from the
 * validated shape. Every value is string-serializable, which is what keeps the
 * URL round-trip exact.
 */
export const explorerFieldSchemas = {
  search: z.string(),
  opportunityType: z.string(),
  roleProfileId: z.string().uuid(),
  company: z.string(),
  location: z.string(),
  workArrangement: workArrangementSchema,
  employmentType: employmentTypeSchema,
  seniority: senioritySchema,
  source: sourceTypeSchema,
  postedAfter: z.string(),
  postedBefore: z.string(),
  firstSeenAfter: z.string(),
  firstSeenBefore: z.string(),
  closesBefore: z.string(),
  state: explorerStateFilterSchema,
  freshness: explorerFreshnessSchema,
  duplicateGroupId: z.string().uuid(),
  sort: explorerSortKeySchema,
} as const;

type ExplorerFieldSchemas = typeof explorerFieldSchemas;
type ExplorerFieldKey = keyof ExplorerFieldSchemas;

/** Stable, canonical ordering of keys for deterministic encoding. */
const EXPLORER_FIELD_KEYS = Object.keys(explorerFieldSchemas) as ExplorerFieldKey[];

/**
 * Explorer filter + sort state. Every dimension is optional; an absent key means
 * "no constraint". This schema contains ONLY filter/sort params — never a user's
 * private state (Req 44.3).
 */
export const explorerStateSchema = z.object({
  search: explorerFieldSchemas.search.optional(),
  opportunityType: explorerFieldSchemas.opportunityType.optional(),
  roleProfileId: explorerFieldSchemas.roleProfileId.optional(),
  company: explorerFieldSchemas.company.optional(),
  location: explorerFieldSchemas.location.optional(),
  workArrangement: explorerFieldSchemas.workArrangement.optional(),
  employmentType: explorerFieldSchemas.employmentType.optional(),
  seniority: explorerFieldSchemas.seniority.optional(),
  source: explorerFieldSchemas.source.optional(),
  postedAfter: explorerFieldSchemas.postedAfter.optional(),
  postedBefore: explorerFieldSchemas.postedBefore.optional(),
  firstSeenAfter: explorerFieldSchemas.firstSeenAfter.optional(),
  firstSeenBefore: explorerFieldSchemas.firstSeenBefore.optional(),
  closesBefore: explorerFieldSchemas.closesBefore.optional(),
  state: explorerFieldSchemas.state.optional(),
  freshness: explorerFieldSchemas.freshness.optional(),
  duplicateGroupId: explorerFieldSchemas.duplicateGroupId.optional(),
  sort: explorerFieldSchemas.sort.optional(),
});
export type ExplorerState = z.infer<typeof explorerStateSchema>;

/**
 * Encode explorer state into a stable query string.
 *
 * Only defined filter/sort fields are emitted (never `undefined`, never any
 * private state). Keys are sorted so the output is deterministic, which makes
 * the string safe to compare, bookmark, and share.
 */
export function encodeExplorerState(state: ExplorerState): string {
  const params = new URLSearchParams();
  for (const key of EXPLORER_FIELD_KEYS) {
    const value = state[key];
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  params.sort();
  return params.toString();
}

/**
 * Decode a query string (or `URLSearchParams`) back into explorer state.
 *
 * Each known param is validated against its field schema; unknown or invalid
 * params are ignored so decoding is total and never throws on hostile input.
 * For any state `s` produced from valid values, `decode(encode(s))` deep-equals
 * `s` (Property 22).
 */
export function decodeExplorerState(input: string | URLSearchParams): ExplorerState {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input;
  const draft: Record<string, unknown> = {};
  for (const key of EXPLORER_FIELD_KEYS) {
    const raw = params.get(key);
    if (raw === null) {
      continue;
    }
    const parsed = explorerFieldSchemas[key].safeParse(raw);
    if (parsed.success) {
      draft[key] = parsed.data;
    }
  }
  return explorerStateSchema.parse(draft);
}
