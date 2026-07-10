/**
 * Pipeline dependency container + typed BullMQ queue construction.
 *
 * A single {@link PipelineContext} is built once at bootstrap and threaded into
 * every stage handler. Queues are created with idempotent-friendly defaults
 * (retry attempts + exponential backoff); exhausted retries are routed to a DLQ
 * by the worker layer (Req 27.3, 55).
 */

import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import type { Config } from '@careerstack/config';
import type { ConnectorRegistry } from '@careerstack/connectors';
import type { CheckpointStore } from '@careerstack/connectors';
import type { Database } from '@careerstack/database';
import type { Logger } from '@careerstack/observability';
import type { SafeFetcher } from '@careerstack/security';
import type { ArtifactStore } from './storage/artifact-store.js';
import {
  QUEUE_NAMES,
  type DeduplicationJobData,
  type DiscoveryJobData,
  type ExpiryCheckJobData,
  type FetchJobData,
  type NormalizationJobData,
  type OutboxDispatchJobData,
  type ParseJobData,
  type RetentionCleanupJobData,
} from './queues.js';

/** Strongly-typed handle to each pipeline queue. */
export interface Queues {
  connectorDiscovery: Queue<DiscoveryJobData>;
  sourceFetch: Queue<FetchJobData>;
  artifactParse: Queue<ParseJobData>;
  normalization: Queue<NormalizationJobData>;
  deduplication: Queue<DeduplicationJobData>;
  expiryCheck: Queue<ExpiryCheckJobData>;
  retentionCleanup: Queue<RetentionCleanupJobData>;
  outboxDispatch: Queue<OutboxDispatchJobData>;
}

/** Everything a stage handler needs at runtime. */
export interface PipelineContext {
  db: Database;
  config: Config;
  logger: Logger;
  registry: ConnectorRegistry;
  fetcher: SafeFetcher;
  storage: ArtifactStore;
  checkpointStore: CheckpointStore;
  queues: Queues;
}

/**
 * Default job options shared by pipeline stages: bounded retries with
 * exponential backoff + jitter-friendly base, and automatic cleanup of
 * completed/failed job records so Redis does not grow unbounded.
 */
export function defaultJobOptions(config: Config): JobsOptions {
  return {
    attempts: config.rateLimit.maxRetries + 1,
    backoff: { type: 'exponential', delay: config.rateLimit.backoffBaseMs },
    removeOnComplete: { count: 1000 },
    // Keep failed jobs so the DLQ relay + admin can inspect them.
    removeOnFail: false,
  };
}

/** Construct all pipeline queues on a shared Redis connection. */
export function createQueues(connection: ConnectionOptions, config: Config): Queues {
  const opts = defaultJobOptions(config);
  const make = <T>(name: string): Queue<T> =>
    new Queue<T>(name, { connection, defaultJobOptions: opts });

  return {
    connectorDiscovery: make<DiscoveryJobData>(QUEUE_NAMES.connectorDiscovery),
    sourceFetch: make<FetchJobData>(QUEUE_NAMES.sourceFetch),
    artifactParse: make<ParseJobData>(QUEUE_NAMES.artifactParse),
    normalization: make<NormalizationJobData>(QUEUE_NAMES.normalization),
    deduplication: make<DeduplicationJobData>(QUEUE_NAMES.deduplication),
    expiryCheck: make<ExpiryCheckJobData>(QUEUE_NAMES.expiryCheck),
    retentionCleanup: make<RetentionCleanupJobData>(QUEUE_NAMES.retentionCleanup),
    outboxDispatch: make<OutboxDispatchJobData>(QUEUE_NAMES.outboxDispatch),
  };
}

/** Close every queue (graceful shutdown). */
export async function closeQueues(queues: Queues): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => (q as Queue).close()));
}
