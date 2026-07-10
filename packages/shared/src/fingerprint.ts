/**
 * Normalized-fingerprint hash (Req 36.1 stage 2 / Property 7). Pure +
 * deterministic: identical normalized inputs always produce the same hash.
 *
 * `fingerprint = sha256(normalized_company | normalized_title |
 *  normalized_location | employment_type)`.
 *
 * NOTE (deviation from Design §4): the design lists an optional
 * `posting_date_bucket` component. It is intentionally OMITTED here because
 * posting dates commonly differ across sources for the *same* opportunity,
 * which would defeat fingerprint-based dedup. Task 10.1 specifies exactly the
 * four-field tuple used below.
 */

import { createHash } from 'node:crypto';

/** Field separator unlikely to occur inside a normalized value. */
const SEP = '\u0001';

/** Inputs to the normalized fingerprint (already normalized/lower-cased). */
export interface FingerprintInput {
  normalizedCompany: string;
  normalizedTitle: string;
  /** Stable location key (`city|region|country|remote`). */
  locationKey: string;
  /** Canonical employment-type enum value, or `undefined` when unknown. */
  employmentType?: string;
}

/**
 * Compute the deterministic normalized fingerprint as a lower-case hex string.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.normalizedCompany,
    input.normalizedTitle,
    input.locationKey,
    input.employmentType ?? '',
  ];
  return createHash('sha256').update(parts.join(SEP)).digest('hex');
}
