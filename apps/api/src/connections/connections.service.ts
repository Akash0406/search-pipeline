/**
 * Connection orchestration (Design API §7 Sources/Runs; Req 20, 23, 24, 25, 54).
 *
 * All operations are ownership-scoped: reads/writes go through
 * {@link ConnectionRepository}, whose queries pin `WHERE user_id = :ownerId`, so
 * a caller can never see or mutate another user's connection (PRIV-006 / Req
 * 54). A foreign/missing id surfaces as 404.
 *
 * Run triggers open a real `running` run row at trigger time and enqueue a
 * `connector-discovery` job carrying that run id + the request's correlation id;
 * the worker attaches counts/outcome to the same run. Removing a connection is a
 * soft delete (`status = removed`) that stops scheduling while KEEPING
 * previously ingested opportunities accessible (Req 25.3) — this service never
 * deletes opportunities.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { getOrCreateCorrelationId } from '@careerstack/observability';
import type { SourceType } from '@careerstack/connectors';
import type {
  Connection,
  ConnectionListResponse,
  ConnectionStatus,
  ConnectorListResponse,
  ConnectorRun,
  ConnectorRunStatus,
  CreateConnectionRequest,
  HealthStatus,
  ManualUrlSubmitResponse,
  RunListResponse,
  TriggerRunResponse,
  UpdateConnectionRequest,
} from '@careerstack/contracts';
import { ConnectionRepository, type ConnectionRow } from './connection.repository.js';
import { ConnectionRunRepository, type ConnectorRunRow } from './connection-run.repository.js';
import { ConnectionsQueue } from './connections-queue.service.js';
import { availableConnectorTypes, validateConnectionConfig } from './connector-metadata.js';

const CONNECTION_STATUSES: readonly ConnectionStatus[] = ['active', 'paused', 'removed'];
const HEALTH_STATUSES: readonly HealthStatus[] = ['healthy', 'degraded', 'failing', 'unknown'];
const RUN_STATUSES: readonly ConnectorRunStatus[] = ['running', 'succeeded', 'failed'];

const DEFAULT_RUN_LIMIT = 20;
const MAX_RUN_LIMIT = 100;

const toConnectionStatus = (value: string): ConnectionStatus =>
  CONNECTION_STATUSES.includes(value as ConnectionStatus) ? (value as ConnectionStatus) : 'active';

const toHealthStatus = (value: string | null): HealthStatus =>
  HEALTH_STATUSES.includes(value as HealthStatus) ? (value as HealthStatus) : 'unknown';

const toRunStatus = (value: string): ConnectorRunStatus =>
  RUN_STATUSES.includes(value as ConnectorRunStatus) ? (value as ConnectorRunStatus) : 'running';

/** Map a stored run row onto the wire DTO (Req 24 observable runs). */
function toRun(row: ConnectorRunRow): ConnectorRun {
  return {
    id: row.id,
    connectionId: row.connectionId,
    status: toRunStatus(row.status),
    startedAt: row.startedAt.toISOString(),
    ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
    itemsDiscovered: row.itemsDiscovered ?? 0,
    itemsFetched: row.itemsFetched ?? 0,
    itemsParsed: row.itemsParsed ?? 0,
    itemsPersisted: row.itemsPersisted ?? 0,
    itemsFailed: row.itemsFailed ?? 0,
    ...(row.failureReason ? { failureReason: row.failureReason } : {}),
  };
}

/** Map a stored connection row (+ optional latest run) onto the wire DTO. */
function toConnection(row: ConnectionRow, lastRun?: ConnectorRunRow | null): Connection {
  return {
    id: row.id,
    sourceType: row.sourceType,
    config: (row.config ?? {}) as Record<string, unknown>,
    status: toConnectionStatus(row.status),
    healthStatus: toHealthStatus(row.healthStatus),
    ...(row.lastHealthReason ? { lastHealthReason: row.lastHealthReason } : {}),
    consecutiveFailures: row.consecutiveFailures ?? 0,
    ...(lastRun ? { lastRun: toRun(lastRun) } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
  };
}

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly repo: ConnectionRepository,
    private readonly runs: ConnectionRunRepository,
    private readonly queue: ConnectionsQueue,
  ) {}

  /** List available connector types from the registry (Req 20 / SRC-001). */
  listConnectorTypes(): ConnectorListResponse {
    return {
      connectors: availableConnectorTypes().map((c) => ({
        id: c.sourceType,
        sourceType: c.sourceType,
        displayName: c.displayName,
        isFirstParty: c.isFirstParty,
      })),
    };
  }

  /** List the caller's connections with each one's most recent run (Req 24.2, 54.3). */
  async list(userId: string): Promise<ConnectionListResponse> {
    const rows = await this.repo.listOwned(userId);
    const connections = await Promise.all(
      rows.map(async (row) => toConnection(row, await this.runs.latestForConnection(row.id))),
    );
    return { connections };
  }

  /**
   * Create a connection for the caller, then enqueue an initial discovery run
   * (Req 20, 24). Config is validated per connector family (Req 21–23).
   */
  async create(userId: string, request: CreateConnectionRequest): Promise<Connection> {
    const validation = validateConnectionConfig(
      request.sourceType,
      request.config as Record<string, unknown>,
    );
    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    const row = await this.repo.create({
      userId,
      sourceType: request.sourceType,
      config: validation.config,
      displayName: validation.displayName,
      isFirstParty: validation.isFirstParty,
    });

    // Kick off an initial discovery run; the worker opens the run row (no runId
    // passed) so we never fabricate run counts here.
    await this.queue.enqueueDiscovery({
      connectionId: row.id,
      correlationId: getOrCreateCorrelationId(),
    });

    return toConnection(row);
  }

  /** Pause/resume or reconfigure an owned connection (Req 25.1). */
  async update(userId: string, id: string, request: UpdateConnectionRequest): Promise<Connection> {
    const existing = await this.repo.findOwned(id, userId);
    if (!existing || existing.status === 'removed') {
      throw new NotFoundException('Connection not found.');
    }

    const patch: { status?: 'active' | 'paused'; config?: Record<string, unknown> } = {};
    if (request.status !== undefined) patch.status = request.status;
    if (request.config !== undefined) {
      const validation = validateConnectionConfig(
        existing.sourceType as SourceType,
        request.config as Record<string, unknown>,
      );
      if (!validation.ok) {
        throw new BadRequestException(validation.message);
      }
      patch.config = validation.config;
    }

    const updated = await this.repo.updateOwned(id, userId, patch);
    if (!updated) {
      throw new NotFoundException('Connection not found.');
    }
    return toConnection(updated, await this.runs.latestForConnection(updated.id));
  }

  /**
   * Remove an owned connection (soft delete → `status = removed`). Scheduling
   * stops; previously ingested opportunities are retained untouched (Req 25.3).
   */
  async remove(userId: string, id: string): Promise<{ status: 'removed' }> {
    const removed = await this.repo.markRemoved(id, userId);
    if (!removed) {
      throw new NotFoundException('Connection not found.');
    }
    return { status: 'removed' };
  }

  /** Trigger an observable run for an owned, non-removed connection (Req 24 / SRC-005). */
  async triggerRun(userId: string, id: string): Promise<TriggerRunResponse> {
    const connection = await this.repo.findOwned(id, userId);
    if (!connection || connection.status === 'removed') {
      throw new NotFoundException('Connection not found.');
    }

    const correlationId = getOrCreateCorrelationId();
    const run = await this.runs.openRun(connection.id, correlationId);
    await this.queue.enqueueDiscovery({
      connectionId: connection.id,
      correlationId,
      runId: run.id,
    });
    return { runId: run.id, status: toRunStatus(run.status) };
  }

  /** List an owned connection's runs, newest first, paginated (Req 24 / SRC-005). */
  async listRuns(
    userId: string,
    id: string,
    pagination: { limit?: number; offset?: number },
  ): Promise<RunListResponse> {
    const connection = await this.repo.findOwned(id, userId);
    if (!connection) {
      throw new NotFoundException('Connection not found.');
    }
    const limit = clampLimit(pagination.limit);
    const offset = clampOffset(pagination.offset);
    const rows = await this.runs.listForConnection(connection.id, limit, offset);
    return { runs: rows.map(toRun) };
  }

  /**
   * Submit a single URL: create or reuse a `manual_url` connection for the
   * caller, then enqueue a discovery run that fetches + parses the URL (Req 23 /
   * SRC-004). The worker routes unparseable URLs to the review queue.
   */
  async submitManualUrl(userId: string, url: string): Promise<ManualUrlSubmitResponse> {
    const validation = validateConnectionConfig('manual_url', { url });
    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    let connection = await this.repo.findOwnedBySourceAndConfigKey(
      userId,
      'manual_url',
      'url',
      url,
    );
    if (connection && connection.status !== 'active') {
      // Reactivate a paused reused connection so the run is actually scheduled.
      connection = await this.repo.updateOwned(connection.id, userId, { status: 'active' });
    }
    if (!connection) {
      connection = await this.repo.create({
        userId,
        sourceType: 'manual_url',
        config: validation.config,
        displayName: validation.displayName,
        isFirstParty: validation.isFirstParty,
      });
    }

    const correlationId = getOrCreateCorrelationId();
    const run = await this.runs.openRun(connection.id, correlationId);
    await this.queue.enqueueDiscovery({
      connectionId: connection.id,
      correlationId,
      runId: run.id,
    });
    return { runId: run.id, status: toRunStatus(run.status) };
  }
}

const clampLimit = (limit?: number): number => {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_RUN_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_RUN_LIMIT);
};

const clampOffset = (offset?: number): number => {
  if (offset === undefined || Number.isNaN(offset)) return 0;
  return Math.max(Math.trunc(offset), 0);
};
