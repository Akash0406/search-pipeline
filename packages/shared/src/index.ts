/**
 * `@careerstack/shared` — pure domain logic: normalization, deduplication and
 * canonicalization helpers.
 *
 * Boundary rule: this package MUST stay free of framework/adapter imports
 * (NestJS, Fastify, Next.js, Drizzle, ioredis) so it remains property-testable.
 * It imports only *types* from `@careerstack/connectors` and the pure
 * `canonicalizeUrl` helper from `@careerstack/security`.
 */
export const SHARED_PACKAGE = '@careerstack/shared' as const;

// --- Canonical domain types (Design §5) -------------------------------------
export type {
  SourceType,
  ExtractionMethod,
  ClosureSignal,
  WorkArrangement,
  EmploymentType,
  Seniority,
  SalaryPeriod,
  CanonicalStatus,
  Evidence,
  SalaryRange,
  StructuredLocation,
  OpportunitySourceRef,
  SourceMeta,
  DedupCandidate,
  CanonicalCandidate,
  NormalizationResult,
  NormalizationFailure,
} from './types.js';

// --- Normalization mapper (Task 10.1, Req 33/34) ----------------------------
export { normalize } from './normalize.js';

// --- Deduplication engine (Task 10.2, Req 36/37) ----------------------------
export {
  deduplicate,
  fuzzyConfidence,
  DEFAULT_DEDUP_CONFIG,
  type DedupConfig,
  type DedupStage,
  type DedupGroup,
  type ReviewPair,
  type DedupResult,
} from './dedup.js';

// --- Pure building blocks (reusable + independently testable) ---------------
export { computeFingerprint, type FingerprintInput } from './fingerprint.js';
export { collapseWhitespace, normalizeTitle, normalizeCompany, tokenize } from './text.js';
export { parseLocation, locationKey, looksRemote } from './location.js';
export { normalizeSalary } from './salary.js';
export {
  mapWorkArrangement,
  mapEmploymentType,
  mapSeniority,
  mapSalaryPeriod,
} from './enum-mappers.js';
export {
  jaroWinkler,
  tokenSetSimilarity,
  titleSimilarity,
  companySimilarity,
  locationProximity,
} from './similarity.js';
