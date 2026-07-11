/**
 * `@careerstack/worker` — BullMQ consumers running the ingestion pipeline
 * (discovery → fetch → parse → normalize → dedup → persist), plus expiry,
 * retention-cleanup and outbox-dispatch jobs.
 *
 * The public surface below lets the API/tests construct or drive the pipeline
 * without starting the process. `main.ts` is the runnable entrypoint.
 */
export const WORKER_APP = '@careerstack/worker' as const;

export { bootstrap, type WorkerRuntime } from './bootstrap.js';
export { main } from './main.js';

// Queue topology + job contracts.
export {
  QUEUE_NAMES,
  ALL_QUEUE_NAMES,
  DLQ_SUFFIX,
  dlqNameFor,
  type QueueName,
  type QueueJobDataMap,
  type DiscoveryJobData,
  type FetchJobData,
  type ParseJobData,
  type NormalizationJobData,
  type DeduplicationJobData,
  type ExpiryCheckJobData,
  type RetentionCleanupJobData,
  type OutboxDispatchJobData,
  type ExportJobData,
} from './queues.js';

// Context + wiring.
export {
  createQueues,
  closeQueues,
  defaultJobOptions,
  type Queues,
  type PipelineContext,
} from './context.js';
export { createRedisConnection, BULLMQ_REDIS_OPTIONS } from './redis.js';
export { Scheduler, DEFAULT_SCHEDULER_INTERVALS, type SchedulerIntervals } from './scheduler.js';
export { startWorkers, type WorkerSet } from './workers.js';
export {
  DeadLetterQueues,
  isExhausted,
  recordStageFailure,
  type DeadLetterPayload,
} from './dlq.js';

// Storage + checkpoint adapters.
export {
  S3ArtifactStore,
  type ArtifactStore,
  type StoredArtifact,
  type StoredExport,
} from './storage/artifact-store.js';
export { DbCheckpointStore } from './checkpoint-store.js';

// Stage handlers (pure-ish; take a PipelineContext).
export { runDiscovery } from './stages/discovery.js';
export { runFetch } from './stages/fetch.js';
export { runParse } from './stages/parse.js';
export { runNormalize } from './stages/normalize.js';
export { runDedup } from './stages/dedup.js';
export { runExpiryCheck } from './stages/expiry.js';
export { runRetentionCleanup } from './stages/retention.js';
export { runOutboxDispatch } from './stages/outbox.js';
export { runExportJob } from './stages/export.js';

// Run + content-change helpers.
export {
  openRun,
  finishRun,
  incrementRunCounter,
  recordConnectionFailure,
  recordConnectionHealthy,
  type RunCounter,
} from './runs.js';
export {
  canonicalContentHash,
  diffCanonicalFields,
  snapshotFromCandidate,
  hashSnapshot,
  type CanonicalSnapshot,
} from './content-change.js';
