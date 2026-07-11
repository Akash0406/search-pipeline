/**
 * Normalization mapper (pure) — Task 10.1, Design §3, Req 33/34.
 *
 * `normalize(parsed, source)` maps a connector-produced {@link ParsedOpportunity}
 * into canonical field values, each accompanied by {@link Evidence}, and either
 * returns a valid {@link CanonicalCandidate} or a validation-failure signal for
 * the pipeline to route to the Review_Queue.
 *
 * Enforced invariants:
 *  - NO FABRICATION (Req 34.3, 34.4 / Property 16): salary, work-rights,
 *    requirements and closing dates absent from the source are never invented.
 *    Because every {@link ParsedOpportunity} fact is already evidence-wrapped
 *    and optional, "absent from source" == "field is `undefined`", and this
 *    mapper only emits a canonical value when the corresponding parsed field is
 *    present. Free-text values that cannot be mapped onto a fixed enum are
 *    OMITTED, not defaulted.
 *  - EVIDENCE COMPLETENESS (Req 34.1, 34.2 / Property 18): exactly one Evidence
 *    record is emitted per populated canonical fact, carrying a valid
 *    ExtractionMethod, the source snippet, confidence and the `uncertain` flag.
 *  - SCHEMA CONFORMANCE (Req 33.1 / Property 17): the result is a valid
 *    candidate only when the required canonical fields (title, company,
 *    canonical URL) resolved; otherwise a failure with reasons is returned.
 *  - RESERVED FIELDS (Req 33.3): match/analysis attributes are never produced
 *    here — the {@link CanonicalCandidate} shape has no such fields to touch.
 */

import { canonicalizeUrl } from '@careerstack/security';
import type { EvidenceValue, ParsedOpportunity } from '@careerstack/connectors';

import { mapEmploymentType, mapSeniority, mapWorkArrangement } from './enum-mappers.js';
import { computeFingerprint } from './fingerprint.js';
import { locationKey, looksRemote, parseLocation } from './location.js';
import { normalizeSalary } from './salary.js';
import { collapseWhitespace, normalizeCompany, normalizeTitle } from './text.js';
import type {
  CanonicalCandidate,
  Evidence,
  NormalizationResult,
  OpportunitySourceRef,
  SourceMeta,
  StructuredLocation,
  WorkArrangement,
} from './types.js';

/** Build a canonical {@link Evidence} record from a parsed evidence value. */
function toEvidence(field: string, ev: EvidenceValue<unknown>): Evidence {
  return {
    field,
    rawArtifactId: ev.evidence.rawArtifactId,
    sourceText: ev.evidence.sourceText,
    method: ev.evidence.method,
    confidence: ev.evidence.confidence,
    uncertain: ev.uncertain === true,
  };
}

/** Try each URL candidate in priority order; return the first that canonicalizes. */
function resolveCanonicalUrl(candidates: ReadonlyArray<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) continue;
    try {
      return canonicalizeUrl(candidate);
    } catch {
      // Not a usable web URL — try the next candidate.
    }
  }
  return undefined;
}

/**
 * Normalize a parsed opportunity into a canonical candidate (or a review
 * signal). Pure and deterministic: identical inputs always yield an identical
 * result.
 */
export function normalize(parsed: ParsedOpportunity, source: SourceMeta): NormalizationResult {
  const evidence: Evidence[] = [];
  const artifactId = source.rawArtifactId;

  // --- Identity / provenance source ref (never a "fact", so no evidence) ----
  const applyUrl = resolveCanonicalUrl([parsed.applyUrl?.value]);
  const canonicalUrl = resolveCanonicalUrl([
    parsed.canonicalUrlHint?.value,
    source.sourceUrl,
    parsed.applyUrl?.value,
  ]);

  const sourceRef: OpportunitySourceRef = {
    id: source.sourceRefId ?? `${source.sourceType}:${source.externalId}`,
    sourceType: source.sourceType,
    externalId: source.externalId,
    sourceUrl: source.sourceUrl,
    isFirstParty: source.isFirstParty,
    rawArtifactId: artifactId,
  };
  if (applyUrl !== undefined) sourceRef.applyUrl = applyUrl;

  // --- Title (required) -----------------------------------------------------
  const title = parsed.title ? collapseWhitespace(parsed.title.value) : '';
  if (parsed.title && title.length > 0) evidence.push(toEvidence('title', parsed.title));

  // --- Company (required) ---------------------------------------------------
  const company = parsed.company ? collapseWhitespace(parsed.company.value) : '';
  if (parsed.company && company.length > 0) {
    evidence.push(toEvidence('company', parsed.company));
  }

  // --- Work arrangement (enum, omitted if unmappable) -----------------------
  let workArrangement: WorkArrangement | undefined;
  if (parsed.workArrangement) {
    const mapped = mapWorkArrangement(parsed.workArrangement.value);
    if (mapped) {
      workArrangement = mapped;
      evidence.push(toEvidence('workArrangement', parsed.workArrangement));
    }
  }

  // --- Locations ------------------------------------------------------------
  const remoteFromArrangement = workArrangement === 'remote';
  const locations: StructuredLocation[] = [];
  const locationStrings: string[] = [];
  if (parsed.locations && parsed.locations.length > 0) {
    for (const loc of parsed.locations) {
      const raw = collapseWhitespace(loc.value);
      if (raw.length === 0) continue;
      locations.push(parseLocation(raw, remoteFromArrangement || looksRemote(raw)));
      locationStrings.push(raw);
      evidence.push(toEvidence('locations', loc));
    }
  }
  const isRemote = remoteFromArrangement || locations.some((l) => l.isRemote);

  // --- Employment type (enum, omitted if unmappable) ------------------------
  let employmentType = parsed.employmentType
    ? mapEmploymentType(parsed.employmentType.value)
    : undefined;
  if (parsed.employmentType && employmentType) {
    evidence.push(toEvidence('employmentType', parsed.employmentType));
  } else {
    employmentType = undefined;
  }

  // --- Seniority (enum, omitted if unmappable) ------------------------------
  const seniority = parsed.seniority ? mapSeniority(parsed.seniority.value) : undefined;
  if (parsed.seniority && seniority) {
    evidence.push(toEvidence('seniority', parsed.seniority));
  }

  // --- Salary (ONLY when present in source, Req 34.3) -----------------------
  const salary = parsed.salary ? normalizeSalary(parsed.salary.value) : undefined;
  if (parsed.salary && salary) evidence.push(toEvidence('salary', parsed.salary));

  // --- Posting / closing dates (closing ONLY when present, Req 34.3) --------
  const postedAt = parsed.postedAt?.value;
  if (parsed.postedAt) evidence.push(toEvidence('postedAt', parsed.postedAt));
  const closingAt = parsed.closesAt?.value;
  if (parsed.closesAt) evidence.push(toEvidence('closingAt', parsed.closesAt));

  // --- Description ----------------------------------------------------------
  const description = parsed.descriptionHtml?.value;
  if (parsed.descriptionHtml) {
    evidence.push(toEvidence('description', parsed.descriptionHtml));
  }

  // --- Derived identity/fuzzy signals ---------------------------------------
  const normalizedTitle = normalizeTitle(title);
  const normalizedCompany = normalizeCompany(company);
  const locKey = locationKey(locations, isRemote);
  const fingerprint = computeFingerprint({
    normalizedCompany,
    normalizedTitle,
    locationKey: locKey,
    employmentType: employmentType ?? '',
  });
  const evidenceConfidence = evidence.reduce(
    (max, e) => (e.confidence > max ? e.confidence : max),
    0,
  );

  // --- Validation (Req 33.1 / Property 17) ----------------------------------
  const reasons: string[] = [];
  if (title.length === 0) reasons.push('missing required field: title');
  if (company.length === 0) reasons.push('missing required field: company');
  if (canonicalUrl === undefined) {
    reasons.push('could not resolve a canonical (identity) URL');
  }
  if (reasons.length > 0) {
    return { ok: false, failure: { reasons, source: sourceRef, evidence } };
  }

  const candidate: CanonicalCandidate = {
    key: sourceRef.id,
    sourceType: source.sourceType,
    externalId: source.externalId,
    canonicalUrl: canonicalUrl as string,
    fingerprint,
    isFirstParty: source.isFirstParty,
    normalizedTitle,
    normalizedCompany,
    locationKey: locKey,
    evidenceConfidence,
    title,
    company,
    locations,
    locationStrings,
    source: sourceRef,
    evidence,
  };
  if (applyUrl !== undefined) candidate.applyUrl = applyUrl;
  if (source.atsBoard !== undefined) candidate.atsBoard = source.atsBoard;
  if (source.atsPostingId !== undefined) candidate.atsPostingId = source.atsPostingId;
  if (source.updatedAt !== undefined) candidate.updatedAt = source.updatedAt;
  if (workArrangement !== undefined) candidate.workArrangement = workArrangement;
  if (employmentType !== undefined) candidate.employmentType = employmentType;
  if (seniority !== undefined) candidate.seniority = seniority;
  if (salary !== undefined) candidate.salary = salary;
  if (description !== undefined) candidate.description = description;
  if (postedAt !== undefined) candidate.postedAt = postedAt;
  if (closingAt !== undefined) candidate.closingAt = closingAt;
  if (parsed.closureSignal !== undefined) candidate.closureSignal = parsed.closureSignal;

  return { ok: true, candidate };
}
