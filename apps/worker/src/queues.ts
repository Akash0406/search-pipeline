/**
 * Queue topology + job-payload contracts for the ingestion pipeline (Design
 * Worker §9). Each pipeline concern is one BullMQ queue; a matching
 * `<name>-dlq` queue receives jobs whose retries are exhausted.
 *
 * Payloads are plain JSON (no Buffers): raw bodies live in object storage and
 * are re-loaded by `rawArtifactId`, keeping every job small and idempotent.
 */

import type {
  ClosureSignal,
  DiscoveryRef,
  ParsedOpportunity,
  SourceType,
} from '@careerstack/connectors';
import type { CanonicalCandidate, SourceMeta } from '@careerstack/shared';

/** Canonical queue names, one per pipeline concern. */
export const QUEUE_NAMES = {
  connectorDiscovery: 'connector-discovery',
  sourceFetch: 'source-fetch',
  artifactParse: 'artifact-parse',
  normalization: 'normalization',
  deduplication: 'deduplication',
  expiryCheck: 'expiry-check',
  retentionCleanup: 'retention-cleanup',
  outboxDispatch: 'outbox-dispatch',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Every pipeline queue name, in dependency order. */
export const ALL_QUEUE_NAMES: readonly QueueName[] = [
  QUEUE_NAMES.connectorDiscovery,
  QUEUE_NAMES.sourceFetch,
  QUEUE_NAMES.artifactParse,
  QUEUE_NAMES.normalization,
  QUEUE_NAMES.deduplication,
  QUEUE_NAMES.expiryCheck,
  QUEUE_NAMES.retentionCleanup,
  QUEUE_NAMES.outboxDispatch,
];

/** Suffix appended to a queue name to form its dead-letter queue (Req 55/27.3). */
export const DLQ_SUFFIX = '-dlq' as const;

/** The dead-letter queue name for a given pipeline queue. */
export function dlqNameFor(queue: QueueName): string {
  return `${queue}${DLQ_SUFFIX}`;
}

// --- Job payloads -----------------------------------------------------------

/** connector-discovery: run `connector.discover` for one active connection. */
export interface DiscoveryJobData {
  connectionId: string;
  correlationId: string;
  /** Existing run id when re-enqueued; a new run is opened when absent. */
  runId?: string;
}

/** source-fetch: fetch one discovered reference via SafeFetcher. */
export interface FetchJobData {
  connectionId: string;
  runId: string;
  correlationId: string;
  sourceType: SourceType;
  ref: DiscoveryRef;
}

/** artifact-parse: parse a stored Raw_Artifact into a ParsedOpportunity. */
export interface ParseJobData {
  connectionId: string;
  runId: string;
  correlationId: string;
  sourceType: SourceType;
  rawArtifactId: string;
  sourceUrl: string;
  externalId: string;
  isFirstParty: boolean;
  hints?: Record<string, string>;
}

/** normalization: map ParsedOpportunity → canonical candidate. */
export interface NormalizationJobData {
  correlationId: string;
  connectionId: string;
  rawArtifactId: string;
  source: SourceMeta;
  parsed: ParsedOpportunity;
}

/** deduplication: resolve + persist a normalized candidate transactionally. */
export interface DeduplicationJobData {
  correlationId: string;
  connectionId: string;
  rawArtifactId: string;
  candidate: CanonicalCandidate;
  /** Raw description HTML (sanitized before persisting to opportunity_content). */
  descriptionHtml?: string;
  requirements?: string[];
  skills?: string[];
  postedAt?: string;
  closureSignal?: ClosureSignal;
}

/** expiry-check: detect closure/removal for opportunities. */
export interface ExpiryCheckJobData {
  correlationId: string;
  /** When present, only this opportunity is evaluated; else a sweep. */
  opportunityId?: string;
  /** Source closure signal for a targeted evaluation (Req 38.1/38.2). */
  closureSignal?: ClosureSignal;
  /** Raw artifact backing the closure signal (for a review item). */
  rawArtifactId?: string;
}

/** retention-cleanup: delete/anonymize raw artifacts past their window. */
export interface RetentionCleanupJobData {
  correlationId: string;
  /** Safety cap on the number of artifacts processed per run. */
  batchSize?: number;
}

/** outbox-dispatch: publish unpublished outbox rows at least once. */
export interface OutboxDispatchJobData {
  correlationId: string;
  batchSize?: number;
}

/** Discriminated map of queue name → its job payload type. */
export interface QueueJobDataMap {
  [QUEUE_NAMES.connectorDiscovery]: DiscoveryJobData;
  [QUEUE_NAMES.sourceFetch]: FetchJobData;
  [QUEUE_NAMES.artifactParse]: ParseJobData;
  [QUEUE_NAMES.normalization]: NormalizationJobData;
  [QUEUE_NAMES.deduplication]: DeduplicationJobData;
  [QUEUE_NAMES.expiryCheck]: ExpiryCheckJobData;
  [QUEUE_NAMES.retentionCleanup]: RetentionCleanupJobData;
  [QUEUE_NAMES.outboxDispatch]: OutboxDispatchJobData;
}
