/**
 * Admin read-model aggregations (Capability H, Req 47–48).
 *
 * Read-only projections over connector/ingestion operational tables for the
 * admin connector-health surface. These queries deliberately expose ONLY
 * operational metadata (health, run counts, failure reasons, review-queue
 * kinds) and NEVER full resume/email/opportunity content (Design admin note).
 * Access control + auditing are handled by the {@link AdminGuard} on the
 * controller; this service assumes the caller is already an authorized admin.
 */
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import {
  connections,
  connectorRuns,
  connectors,
  parserRuns,
  rawArtifacts,
  reviewQueueItems,
} from '@careerstack/database';
import type {
  ConnectorHealthItem,
  ConnectorRun,
  HealthStatus,
  ParserFailureItem,
  ReviewQueueItem,
  ReviewReason,
} from '@careerstack/contracts';
import { DB } from '../common/di-tokens.js';

/** Default page size for the recent-activity listings. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const HEALTH_VALUES: readonly HealthStatus[] = ['healthy', 'degraded', 'failing', 'unknown'];

const clampLimit = (limit?: number): number => {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

const toHealth = (value: string | null): HealthStatus =>
  HEALTH_VALUES.includes(value as HealthStatus) ? (value as HealthStatus) : 'unknown';

const iso = (value: Date | null | undefined): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

@Injectable()
export class AdminService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Per-connection health with the connector display name (Req 47.1). */
  async connectorHealth(): Promise<ConnectorHealthItem[]> {
    const rows = await this.db
      .select({
        connectionId: connections.id,
        sourceType: connections.sourceType,
        displayName: connectors.displayName,
        healthStatus: connections.healthStatus,
        lastHealthReason: connections.lastHealthReason,
        consecutiveFailures: connections.consecutiveFailures,
        updatedAt: connections.updatedAt,
      })
      .from(connections)
      .innerJoin(connectors, eq(connections.connectorId, connectors.id))
      .orderBy(desc(connections.updatedAt));

    return rows.map((r) => ({
      connectionId: r.connectionId,
      sourceType: r.sourceType,
      ...(r.displayName ? { displayName: r.displayName } : {}),
      healthStatus: toHealth(r.healthStatus),
      ...(r.lastHealthReason ? { lastHealthReason: r.lastHealthReason } : {}),
      consecutiveFailures: r.consecutiveFailures ?? 0,
      ...(iso(r.updatedAt) ? { lastCheckedAt: iso(r.updatedAt) } : {}),
    }));
  }

  /** Recent connector runs with status, counts, and failure reasons (Req 47.2). */
  async recentRuns(limit?: number): Promise<ConnectorRun[]> {
    const rows = await this.db
      .select()
      .from(connectorRuns)
      .orderBy(desc(connectorRuns.startedAt))
      .limit(clampLimit(limit));

    return rows.map((r) => ({
      id: r.id,
      connectionId: r.connectionId,
      status: r.status as ConnectorRun['status'],
      startedAt: r.startedAt.toISOString(),
      ...(iso(r.finishedAt) ? { finishedAt: iso(r.finishedAt) } : {}),
      itemsDiscovered: r.itemsDiscovered ?? 0,
      itemsFetched: r.itemsFetched ?? 0,
      itemsParsed: r.itemsParsed ?? 0,
      itemsPersisted: r.itemsPersisted ?? 0,
      itemsFailed: r.itemsFailed ?? 0,
      ...(r.failureReason ? { failureReason: r.failureReason } : {}),
    }));
  }

  /** Parser/validation failures with their reasons (Req 48.1). */
  async parserFailures(limit?: number): Promise<ParserFailureItem[]> {
    const rows = await this.db
      .select({
        id: parserRuns.id,
        rawArtifactId: parserRuns.rawArtifactId,
        sourceType: rawArtifacts.sourceType,
        status: parserRuns.status,
        failureReason: parserRuns.failureReason,
        createdAt: parserRuns.createdAt,
      })
      .from(parserRuns)
      .innerJoin(rawArtifacts, eq(parserRuns.rawArtifactId, rawArtifacts.id))
      .where(inArray(parserRuns.status, ['validation_failed', 'parse_failed']))
      .orderBy(desc(parserRuns.createdAt))
      .limit(clampLimit(limit));

    return rows.map((r) => ({
      id: r.id,
      rawArtifactId: r.rawArtifactId,
      sourceType: r.sourceType,
      status: r.status as ParserFailureItem['status'],
      ...(r.failureReason ? { failureReason: r.failureReason } : {}),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Open review-queue items (invalid / uncertain records) (Req 48.2). */
  async reviewQueue(limit?: number): Promise<ReviewQueueItem[]> {
    const rows = await this.db
      .select({
        id: reviewQueueItems.id,
        kind: reviewQueueItems.kind,
        reason: reviewQueueItems.reason,
        rawArtifactId: reviewQueueItems.rawArtifactId,
        opportunitySourceId: reviewQueueItems.opportunitySourceId,
        createdAt: reviewQueueItems.createdAt,
        sourceUrl: rawArtifacts.sourceUrl,
      })
      .from(reviewQueueItems)
      .leftJoin(rawArtifacts, eq(reviewQueueItems.rawArtifactId, rawArtifacts.id))
      .where(eq(reviewQueueItems.status, 'open'))
      .orderBy(desc(reviewQueueItems.createdAt))
      .limit(clampLimit(limit));

    return rows.map((r) => ({
      id: r.id,
      reason: mapReviewReason(r.kind, r.reason),
      ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
      ...(r.rawArtifactId ? { rawArtifactId: r.rawArtifactId } : {}),
      ...(r.opportunitySourceId ? { opportunitySourceId: r.opportunitySourceId } : {}),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

/**
 * Map the stored review-queue `kind` (+ free-text `reason`) onto the contract's
 * fixed reason vocabulary. `invalid_record` is disambiguated to a parse vs
 * validation failure from the reason text when possible.
 */
function mapReviewReason(kind: string, reason: string | null): ReviewReason {
  switch (kind) {
    case 'uncertain_duplicate':
      return 'uncertain_duplicate';
    case 'closure_ambiguous':
      return 'uncertain_closure';
    case 'invalid_record':
    default:
      return reason?.toLowerCase().includes('parse') ? 'parse_failed' : 'validation_failed';
  }
}
