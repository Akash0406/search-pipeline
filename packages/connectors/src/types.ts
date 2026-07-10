/**
 * Core connector-framework types (Design → Connector Framework §1, Req 20).
 *
 * ONE convention (single source of truth):
 *  - {@link SourceType} is a lowercase string-literal union, identical to the
 *    Postgres `source_type` enum values.
 *  - {@link ExtractionMethod} uses the uppercase glossary values (OPP-003).
 *  - The connector exposes a single {@link OpportunityConnector} interface with
 *    `discover()` streaming pagination via `AsyncIterable<DiscoveryRef>`, one
 *    {@link ParsedOpportunity} shape (every field optional + evidence-wrapped),
 *    and one evidence wrapper {@link EvidenceValue}.
 *
 * Boundary rule (SRC-001.2): this package is pure domain logic. It imports only
 * contract/types from `@careerstack/security` and `@careerstack/observability`
 * and reaches the network solely through the injected {@link ConnectorContext}
 * `fetcher` (a `SafeFetcher`). It must never import NestJS/Fastify/Next/Drizzle/
 * ioredis, and connectors never open sockets directly.
 */

import type { Logger } from '@careerstack/observability';
import type { FetchResult, SafeFetcherContract } from '@careerstack/security';

// Re-export the transport-level shapes so consumers of this package have a
// single import site for connector work.
export type { FetchResult, SafeFetchOptions } from '@careerstack/security';

/**
 * Sources the platform can ingest. Values are lowercase and match the Postgres
 * `source_type` enum exactly (app types and DB enums are identical).
 *
 * `gmail` is RESERVED for a future spec and is intentionally never implemented
 * in this slice. Extension points for later specs (not part of the union yet):
 * `sitemap | rss | browser_capture | aggregator_*`.
 */
export type SourceType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'jsonld' // generic schema.org JobPosting career page
  | 'manual_url' // user-submitted single URL (SRC-004)
  | 'gmail'; // RESERVED: future spec, never implemented in this slice

/** The uppercase extraction methods mandated by the glossary / OPP-003. */
export type ExtractionMethod =
  | 'STRUCTURED_DATA'
  | 'RULE'
  | 'PARSER'
  | 'LLM'
  | 'USER';

/** A reference discovered on a source, before fetch. */
export interface DiscoveryRef {
  sourceType: SourceType;
  /** Stable id within the source (e.g. ATS posting id) — exact-identity dedup. */
  externalId: string;
  /** Absolute URL to fetch for this reference. */
  url: string;
  /** Stable key so re-discovery does not re-enqueue duplicates. */
  dedupKey: string;
  /** ISO-8601 timestamp of discovery. */
  discoveredAt: string;
  /** Opaque hints (e.g. updated_at, board token, apply-url hint). */
  hints?: Record<string, string>;
}

/**
 * One extracted fact carrying its provenance (OPP-003).
 *
 * Facts absent from the source are represented by the *absence* of the
 * enclosing field (`undefined`), never by a fabricated {@link EvidenceValue}.
 * When a fact is expected but could not be determined, `uncertain` is `true`.
 */
export interface EvidenceValue<T> {
  value: T;
  evidence: {
    /** Reference to the stored Raw_Artifact the value came from (OPP-003.1). */
    rawArtifactId: string;
    /** Exact source snippet the value was extracted from. */
    sourceText: string;
    /** How the value was extracted (OPP-003.2). */
    method: ExtractionMethod;
    /** Extraction confidence in the range 0..1. */
    confidence: number;
  };
  /** True when the fact could not be determined from the source (OPP-003.4). */
  uncertain?: boolean;
}

/**
 * Parsed opportunity BEFORE normalization. Every field is optional and
 * evidence-wrapped. Facts absent from the source stay `undefined` and are NEVER
 * fabricated (OPP-003.3 / Req 34.3, 34.4).
 */
export interface ParsedOpportunity {
  title?: EvidenceValue<string>;
  company?: EvidenceValue<string>;
  locations?: EvidenceValue<string>[];
  workArrangement?: EvidenceValue<string>;
  employmentType?: EvidenceValue<string>;
  seniority?: EvidenceValue<string>;
  salary?: EvidenceValue<ParsedSalary>;
  postedAt?: EvidenceValue<string>;
  closesAt?: EvidenceValue<string>;
  /** Sanitized downstream; never rendered raw. */
  descriptionHtml?: EvidenceValue<string>;
  applyUrl?: EvidenceValue<string>;
  canonicalUrlHint?: EvidenceValue<string>;
  requirements?: EvidenceValue<string>[];
  skills?: EvidenceValue<string>[];
  /** Closure signal from the source, when available (OPP-007). */
  closureSignal?: ClosureSignal;
}

/** Salary as extracted from a source (only present fields are populated). */
export interface ParsedSalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: string;
}

/** Closure signal reported by a source. */
export type ClosureSignal = 'open' | 'closed' | 'removed' | 'unknown';

/** Per-connection checkpoint used for pagination + conditional fetches. */
export interface Checkpoint {
  /** Pagination position / last successful state (SRC-007.1). */
  cursor?: string;
  /** Per-url ETag for conditional GET (SRC-007.3). */
  etags?: Record<string, string>;
  /** Per-url Last-Modified for conditional GET. */
  lastModified?: Record<string, string>;
  /** ISO-8601 timestamp of the last successful run. */
  lastSuccessfulAt?: string;
}

/** Health of a connection, surfaced to the admin health view (Req 22.2, 24). */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'failing' | 'unknown';
  /** Human-readable detail, e.g. "no valid JobPosting JSON-LD found". */
  message?: string;
  consecutiveFailures: number;
  lastCheckedAt: string;
}

/**
 * Everything a connector needs at runtime. The `fetcher` is the ONLY way a
 * connector may reach the network (SRC-001.2, SEC-001/002). The `signal`
 * lets long-running `discover()` loops abort cooperatively on shutdown.
 */
export interface ConnectorContext {
  connectionId: string;
  /** Board slug / domain / options for the connection. */
  config: Record<string, unknown>;
  /** The injected safe outbound-HTTP fetcher (single network chokepoint). */
  fetcher: SafeFetcherContract;
  logger: Logger;
  correlationId: string;
  signal: AbortSignal;
}

/**
 * The single interface every source implements. The core scheduler runs,
 * monitors, and checkpoints any connector uniformly, with no source-specific
 * handling (SRC-001.3). New sources register in the {@link ConnectorRegistry}
 * without touching the scheduler, pipeline, rate limiter, or DLQ.
 */
export interface OpportunityConnector {
  readonly sourceType: SourceType;
  /** greenhouse/lever/ashby/jsonld = true (SRC-002.3, SRC-003.3). */
  readonly isFirstParty: boolean;

  discover(
    ctx: ConnectorContext,
    checkpoint: Checkpoint,
  ): AsyncIterable<DiscoveryRef>;
  fetch(
    ctx: ConnectorContext,
    ref: DiscoveryRef,
    checkpoint: Checkpoint,
  ): Promise<FetchResult>;
  parse(ctx: ConnectorContext, artifact: FetchResult): Promise<ParsedOpportunity>;
  healthCheck(ctx: ConnectorContext): Promise<HealthStatus>;
  getCheckpoint(ctx: ConnectorContext): Promise<Checkpoint | null>;
  saveCheckpoint(ctx: ConnectorContext, checkpoint: Checkpoint): Promise<void>;
}

/** Re-exported alias so connector code can refer to the injected fetcher type. */
export type SafeFetcher = SafeFetcherContract;
