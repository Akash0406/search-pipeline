/**
 * Canonical domain types for the pure normalization + deduplication layer
 * (Design §5 "Canonical Opportunity & Evidence types", Req 33/34/36/37).
 *
 * These are the application-layer shapes. Their enum VALUE SETS are kept
 * identical to `@careerstack/contracts` (the wire single-source-of-truth) and
 * the Postgres enums, but this pure package intentionally owns plain TS types
 * (no `zod`) so it stays framework-/adapter-free and property-testable.
 *
 * Boundary rule: this file only imports *types* from `@careerstack/connectors`
 * (the connector-side input shapes). It never imports NestJS/Fastify/Next/
 * Drizzle/ioredis.
 */

import type { ClosureSignal, ExtractionMethod, SourceType } from '@careerstack/connectors';

export type { ClosureSignal, ExtractionMethod, SourceType };

// --- Fixed enums (mirror @careerstack/contracts values exactly) -------------

/** Where/how a role is worked. */
export type WorkArrangement = 'on_site' | 'hybrid' | 'remote';

/** Employment relationship. */
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';

/** Role level. */
export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive';

/** Pay period for a salary range. */
export type SalaryPeriod = 'hour' | 'day' | 'month' | 'year';

/** Canonical stored status subset (Saved/Applied/Dismissed are display overlays). */
export type CanonicalStatus =
  | 'New'
  | 'Active'
  | 'Closing soon'
  | 'Closed'
  | 'Expired'
  | 'Removed'
  | 'Needs review'
  | 'Duplicate';

// --- Evidence + value shapes ------------------------------------------------

/**
 * Provenance attached to exactly one populated canonical fact (OPP-003 /
 * Req 34.1, 34.2). Emitted once per fact the normalizer actually populates.
 */
export interface Evidence {
  /** The canonical field this evidence supports (e.g. `title`, `salary`). */
  field: string;
  /** Reference to the stored Raw_Artifact the value came from (Req 34.1). */
  rawArtifactId: string;
  /** Exact source snippet the value was extracted from. */
  sourceText: string;
  /** How the value was extracted (Req 34.2). */
  method: ExtractionMethod;
  /** Extraction confidence in the range 0..1. */
  confidence: number;
  /** True when the fact could not be firmly determined (Req 34.4). */
  uncertain: boolean;
}

/** A salary range; only present when the source actually provided it (Req 34.3). */
export interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
  period?: SalaryPeriod;
}

/** Structured location parsed from free-text (Australia-focused, Design §3). */
export interface StructuredLocation {
  /** The original location string. */
  raw: string;
  city?: string;
  /** State/territory (e.g. `NSW`) or region. */
  region?: string;
  /** ISO-3166 alpha-2 country code where recognised (AU, US, GB, …). */
  country?: string;
  /** True when the location denotes remote/anywhere work. */
  isRemote: boolean;
}

/**
 * A contributing source retained after dedup/merge (OPP-006). The engine keeps
 * every one of these; none is ever discarded.
 */
export interface OpportunitySourceRef {
  id: string;
  sourceType: SourceType;
  externalId: string;
  sourceUrl: string;
  applyUrl?: string;
  /** First-party marker: powers first-party-wins field selection (Req 36.4). */
  isFirstParty: boolean;
  /** Preserved Raw_Artifact reference (Req 37.3). */
  rawArtifactId?: string;
  /** Aggregate extraction confidence for this source. */
  confidence?: number;
}

// --- Normalization input ----------------------------------------------------

/**
 * Non-fact metadata about the source of a {@link ParsedOpportunity}. These are
 * identity/provenance inputs (not extracted facts), so they are plain values
 * rather than evidence-wrapped.
 */
export interface SourceMeta {
  sourceType: SourceType;
  /** Stable id within the source (ATS posting id, JobPosting id, …). */
  externalId: string;
  /** The URL the artifact was fetched from. */
  sourceUrl: string;
  /** Whether this source is a first-party (employer/ATS) source (Req 36.4). */
  isFirstParty: boolean;
  /** Reference to the stored Raw_Artifact (fallback evidence pointer). */
  rawArtifactId: string;
  /** Stable id for the resulting Opportunity_Source row; used as the dedup key. */
  sourceRefId?: string;
  /** ATS board slug (exact-identity signal, Req 36.1). */
  atsBoard?: string;
  /** ATS posting id (exact-identity signal, Req 36.1). */
  atsPostingId?: string;
  /** Source last-updated timestamp (recency tie-break for canonical selection). */
  updatedAt?: string;
}

// --- Deduplication candidate ------------------------------------------------

/**
 * The minimal structural shape the deduplication engine needs. A
 * {@link CanonicalCandidate} is a superset, so normalization output feeds the
 * engine directly.
 */
export interface DedupCandidate {
  /** Stable unique id of this Opportunity_Source candidate. */
  key: string;
  sourceType: SourceType;
  externalId: string;
  /** Canonical (identity) URL — Req 36.1. */
  canonicalUrl: string;
  applyUrl?: string;
  atsBoard?: string;
  atsPostingId?: string;
  /** Normalized-fingerprint hash — Req 36.1 stage 2. */
  fingerprint: string;
  isFirstParty: boolean;
  /** Lower-cased normalized title for fuzzy similarity. */
  normalizedTitle: string;
  /** Lower-cased normalized company for fuzzy similarity. */
  normalizedCompany: string;
  /** Stable location key `city|region|country|remote` for proximity. */
  locationKey: string;
  /** Aggregate evidence confidence (canonical-source tie-break). */
  evidenceConfidence: number;
  /** Source last-updated ISO timestamp (recency tie-break). */
  updatedAt?: string;
}

/**
 * A fully normalized candidate: canonical field values, each backed by
 * {@link Evidence}, plus the identity/fuzzy signals used by dedup.
 */
export interface CanonicalCandidate extends DedupCandidate {
  /** Original title (kept verbatim, Req 33.2). */
  title: string;
  /** Original company. */
  company: string;
  /** Structured locations parsed from source text. */
  locations: StructuredLocation[];
  /** Flat display location strings (raw values). */
  locationStrings: string[];
  workArrangement?: WorkArrangement;
  employmentType?: EmploymentType;
  seniority?: Seniority;
  /** Only present when the source provided salary (Req 34.3). */
  salary?: SalaryRange;
  /** Detail-only description (excluded from list responses, Req 33.4). */
  description?: string;
  postedAt?: string;
  /** Only present when the source provided a closing date (Req 34.3). */
  closingAt?: string;
  /** Closure signal reported by the source (OPP-007), when present. */
  closureSignal?: ClosureSignal;
  /** The retained source reference (provenance, Req 37.1). */
  source: OpportunitySourceRef;
  /** Exactly one Evidence per populated fact (Req 34.1, 34.2 / Property 18). */
  evidence: Evidence[];
}

// --- Normalization result ---------------------------------------------------

/**
 * Result of {@link normalize}. Either a valid canonical candidate, or a
 * validation-failure signal the pipeline routes to the Review_Queue (Req 33.1,
 * Req 35 / Property 17).
 */
export type NormalizationResult =
  { ok: true; candidate: CanonicalCandidate } | { ok: false; failure: NormalizationFailure };

/** Why a parsed record failed canonical-schema validation (Req 35.3). */
export interface NormalizationFailure {
  /** Human-readable failure reasons (recorded on the review item, Req 35.3). */
  reasons: string[];
  /** The originating source reference (kept for review context, Req 35.2). */
  source: OpportunitySourceRef;
  /** Best-effort evidence gathered before validation failed. */
  evidence: Evidence[];
}
