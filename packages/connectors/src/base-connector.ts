/**
 * Shared base for connectors: default checkpoint persistence and small config
 * helpers. Checkpoint storage is *injected* through `ctx.config` (the pipeline
 * supplies a {@link CheckpointStore}) so this pure package never imports a DB
 * or Redis client. When no store is injected, checkpoint access is a no-op and
 * `getCheckpoint` returns `null`.
 */

import type {
  Checkpoint,
  ConnectorContext,
  DiscoveryRef,
  FetchResult,
  HealthStatus,
  OpportunityConnector,
  ParsedOpportunity,
  SourceType,
} from './types.js';

/** Persistence port for connector checkpoints (implemented by the worker). */
export interface CheckpointStore {
  load(connectionId: string): Promise<Checkpoint | null>;
  save(connectionId: string, checkpoint: Checkpoint): Promise<void>;
}

/** Config key under which the pipeline injects a {@link CheckpointStore}. */
export const CHECKPOINT_STORE_CONFIG_KEY = 'checkpointStore';

function resolveCheckpointStore(ctx: ConnectorContext): CheckpointStore | undefined {
  const candidate = ctx.config[CHECKPOINT_STORE_CONFIG_KEY];
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as CheckpointStore).load === 'function' &&
    typeof (candidate as CheckpointStore).save === 'function'
  ) {
    return candidate as CheckpointStore;
  }
  return undefined;
}

/** Read a required string config value, throwing a descriptive error if absent. */
export function requireStringConfig(ctx: ConnectorContext, key: string): string {
  const value = ctx.config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Connector config "${key}" is required and must be a non-empty string`);
  }
  return value.trim();
}

/** Read an optional string config value. */
export function optionalStringConfig(ctx: ConnectorContext, key: string): string | undefined {
  const value = ctx.config[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export abstract class BaseConnector implements OpportunityConnector {
  abstract readonly sourceType: SourceType;
  abstract readonly isFirstParty: boolean;

  abstract discover(ctx: ConnectorContext, checkpoint: Checkpoint): AsyncIterable<DiscoveryRef>;

  abstract fetch(
    ctx: ConnectorContext,
    ref: DiscoveryRef,
    checkpoint: Checkpoint,
  ): Promise<FetchResult>;

  abstract parse(ctx: ConnectorContext, artifact: FetchResult): Promise<ParsedOpportunity>;

  abstract healthCheck(ctx: ConnectorContext): Promise<HealthStatus>;

  async getCheckpoint(ctx: ConnectorContext): Promise<Checkpoint | null> {
    const store = resolveCheckpointStore(ctx);
    return store ? store.load(ctx.connectionId) : null;
  }

  async saveCheckpoint(ctx: ConnectorContext, checkpoint: Checkpoint): Promise<void> {
    const store = resolveCheckpointStore(ctx);
    if (store) await store.save(ctx.connectionId, checkpoint);
  }

  /** Convenience for building a `HealthStatus` from a single probe result. */
  protected health(status: HealthStatus['status'], message?: string): HealthStatus {
    const result: HealthStatus = {
      status,
      consecutiveFailures: status === 'healthy' ? 0 : 1,
      lastCheckedAt: new Date().toISOString(),
    };
    if (message !== undefined) result.message = message;
    return result;
  }
}
