/**
 * Postgres enum types shared across the CareerStack schema.
 *
 * Convention (design → Data Models):
 * - `source_type` uses the SAME lowercase values as the `SourceType` TS union
 *   so app types and DB enums are identical.
 * - `extraction_method` uses the UPPERCASE glossary set mandated by OPP-003.
 * - `opportunity_status` is the CANONICAL stored subset only. The per-user
 *   display overlays (Saved / Applied / Dismissed) are NOT canonical statuses —
 *   they are computed at display time from `opportunity_user_state`.
 *
 * Other fixed value sets (connection status, run status, review kind, user
 * role, etc.) are modelled as plain `text` columns with documented CHECK-style
 * value sets in the design; Postgres enums are reserved for the three sets that
 * are shared verbatim with the application type layer (`packages/contracts`).
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * `source_type` — origin of opportunity data. Lowercase to match the
 * `SourceType` string-literal union in `packages/connectors`.
 * `gmail` is RESERVED for a future spec and never implemented in this slice.
 */
export const sourceTypeEnum = pgEnum('source_type', [
  'greenhouse',
  'lever',
  'ashby',
  'jsonld',
  'manual_url',
  'gmail', // RESERVED (future spec)
]);

/**
 * `extraction_method` — how an extracted fact was derived (Evidence, OPP-003).
 * UPPERCASE per the glossary.
 */
export const extractionMethodEnum = pgEnum('extraction_method', [
  'STRUCTURED_DATA',
  'RULE',
  'PARSER',
  'LLM',
  'USER',
]);

/**
 * `opportunity_status` — canonical stored status subset (Req 46).
 * Saved / Applied / Dismissed are per-user display overlays and are therefore
 * intentionally excluded from this enum.
 */
export const opportunityStatusEnum = pgEnum('opportunity_status', [
  'New',
  'Active',
  'Closing soon',
  'Closed',
  'Expired',
  'Removed',
  'Needs review',
  'Duplicate',
]);
