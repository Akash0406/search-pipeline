/**
 * Connector / ingestion schema (Capability D).
 *
 * Requirements: 24.1, 26.1, 32.2, 35.3, 48.1.
 *
 * Covers the connector registry, per-type default fetch config, user
 * connections, observable runs, resumable checkpoints, raw artifacts (stored
 * BEFORE parsing), and versioned parser definitions/runs.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  createdAt,
  nullableTimestamp,
  primaryKeyId,
  requiredTimestamp,
  updatedAt,
} from './_shared.js';
import { sourceTypeEnum } from './enums.js';
import { accounts, users } from './identity.js';

/** Static registry of available connector types (Req 20). */
export const connectors = pgTable(
  'connectors',
  {
    id: primaryKeyId(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    displayName: text('display_name').notNull(),
    /** greenhouse/lever/ashby/jsonld = true (Req 21.3, 22.3). */
    isFirstParty: boolean('is_first_party').notNull(),
    defaultConfig: jsonb('default_config'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('connectors_source_type_unique').on(t.sourceType)],
);

/** Default / global fetch config per connector type (Req 31 bounds). */
export const connectorConfigs = pgTable('connector_configs', {
  connectorId: uuid('connector_id')
    .primaryKey()
    .references(() => connectors.id, { onDelete: 'cascade' }),
  rateLimitPerMin: integer('rate_limit_per_min').notNull(),
  maxBytes: integer('max_bytes').notNull(),
  timeoutMs: integer('timeout_ms').notNull(),
  maxRedirects: integer('max_redirects').notNull(),
  allowedContentTypes: text('allowed_content_types').array().notNull(),
  /** cron-like recurring schedule. */
  defaultSchedule: text('default_schedule'),
});

/** A user-configured, running instance of a connector (Req 20, 25). */
export const connections = pgTable(
  'connections',
  {
    id: primaryKeyId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    connectorId: uuid('connector_id')
      .notNull()
      .references(() => connectors.id),
    sourceType: sourceTypeEnum('source_type').notNull(),
    /** board slug / domain / URL. */
    config: jsonb('config').notNull(),
    /** 'active' | 'paused' | 'removed' (Req 25). */
    status: text('status').notNull().default('active'),
    /** 'healthy' | 'degraded' | 'failing' | 'unknown' (Req 22.2, 24). */
    healthStatus: text('health_status').default('unknown'),
    lastHealthReason: text('last_health_reason'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    /** OAuth-backed sources (Req 51); nullable. */
    oauthAccountId: uuid('oauth_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('connections_user_id_idx').on(t.userId),
    index('connections_status_idx').on(t.status),
  ],
);

/** Observable connector runs (Req 24). */
export const connectorRuns = pgTable(
  'connector_runs',
  {
    id: primaryKeyId(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    correlationId: text('correlation_id').notNull(),
    /** 'running' | 'succeeded' | 'failed'. */
    status: text('status').notNull(),
    startedAt: requiredTimestamp('started_at'),
    finishedAt: nullableTimestamp('finished_at'),
    itemsDiscovered: integer('items_discovered').default(0),
    itemsFetched: integer('items_fetched').default(0),
    itemsParsed: integer('items_parsed').default(0),
    itemsPersisted: integer('items_persisted').default(0),
    itemsFailed: integer('items_failed').default(0),
    /** Failure reason recorded against the run (Req 24.3). */
    failureReason: text('failure_reason'),
  },
  (t) => [index('connector_runs_connection_started_idx').on(t.connectionId, t.startedAt)],
);

/** Resumable per-connection checkpoint state (Req 26). */
export const connectorCheckpoints = pgTable('connector_checkpoints', {
  connectionId: uuid('connection_id')
    .primaryKey()
    .references(() => connections.id, { onDelete: 'cascade' }),
  cursor: text('cursor'),
  /** per-url ETag for conditional GET (Req 26.3). */
  etags: jsonb('etags'),
  lastModified: jsonb('last_modified'),
  lastRunAt: nullableTimestamp('last_run_at'),
  lastSuccessfulAt: nullableTimestamp('last_successful_at'),
});

/** Raw fetched content, stored BEFORE parsing (Req 32). */
export const rawArtifacts = pgTable(
  'raw_artifacts',
  {
    id: primaryKeyId(),
    connectionId: uuid('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    sourceType: sourceTypeEnum('source_type').notNull(),
    sourceUrl: text('source_url').notNull(),
    /** Fetch timestamp (Req 32.2). */
    fetchedAt: requiredTimestamp('fetched_at'),
    httpStatus: integer('http_status'),
    contentType: text('content_type'),
    /** includes ETag / Last-Modified. */
    headers: jsonb('headers'),
    /** body stored in S3; signed-URL access only. */
    storageKey: text('storage_key').notNull(),
    /** sha256 for change detection + idempotency (Req 39). */
    contentHash: text('content_hash').notNull(),
    byteSize: integer('byte_size'),
    etag: text('etag'),
    lastModified: text('last_modified'),
    /** configurable retention (Req 53). */
    retentionUntil: nullableTimestamp('retention_until'),
    /** retention removal marker (Req 53.2). */
    deletedAt: nullableTimestamp('deleted_at'),
    correlationId: text('correlation_id'),
    createdAt: createdAt(),
  },
  (t) => [
    // fetch idempotency (OPP-001)
    uniqueIndex('raw_artifacts_connection_url_hash_unique').on(
      t.connectionId,
      t.sourceUrl,
      t.contentHash,
    ),
    index('raw_artifacts_connection_fetched_idx').on(t.connectionId, t.fetchedAt),
    index('raw_artifacts_content_hash_idx').on(t.contentHash),
    index('raw_artifacts_retention_until_idx').on(t.retentionUntil),
  ],
);

/** Versioned parser per source type (Req 48). */
export const parserDefinitions = pgTable(
  'parser_definitions',
  {
    id: primaryKeyId(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    version: integer('version').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('parser_definitions_source_version_unique').on(t.sourceType, t.version),
  ],
);

/** A parse attempt and its outcome (Req 35.3, 48.1). */
export const parserRuns = pgTable(
  'parser_runs',
  {
    id: primaryKeyId(),
    rawArtifactId: uuid('raw_artifact_id')
      .notNull()
      .references(() => rawArtifacts.id, { onDelete: 'cascade' }),
    parserDefinitionId: uuid('parser_definition_id').references(() => parserDefinitions.id),
    correlationId: text('correlation_id'),
    /** 'succeeded' | 'validation_failed' | 'parse_failed'. */
    status: text('status').notNull(),
    failureReason: text('failure_reason'),
    createdAt: createdAt(),
  },
  (t) => [index('parser_runs_raw_artifact_idx').on(t.rawArtifactId)],
);

// -- Relations -------------------------------------------------------------

export const connectorsRelations = relations(connectors, ({ one, many }) => ({
  config: one(connectorConfigs, {
    fields: [connectors.id],
    references: [connectorConfigs.connectorId],
  }),
  connections: many(connections),
}));

export const connectorConfigsRelations = relations(connectorConfigs, ({ one }) => ({
  connector: one(connectors, {
    fields: [connectorConfigs.connectorId],
    references: [connectors.id],
  }),
}));

export const connectionsRelations = relations(connections, ({ one, many }) => ({
  user: one(users, { fields: [connections.userId], references: [users.id] }),
  connector: one(connectors, {
    fields: [connections.connectorId],
    references: [connectors.id],
  }),
  oauthAccount: one(accounts, {
    fields: [connections.oauthAccountId],
    references: [accounts.id],
  }),
  runs: many(connectorRuns),
  checkpoint: one(connectorCheckpoints, {
    fields: [connections.id],
    references: [connectorCheckpoints.connectionId],
  }),
  rawArtifacts: many(rawArtifacts),
}));

export const connectorRunsRelations = relations(connectorRuns, ({ one }) => ({
  connection: one(connections, {
    fields: [connectorRuns.connectionId],
    references: [connections.id],
  }),
}));

export const connectorCheckpointsRelations = relations(connectorCheckpoints, ({ one }) => ({
  connection: one(connections, {
    fields: [connectorCheckpoints.connectionId],
    references: [connections.id],
  }),
}));

export const rawArtifactsRelations = relations(rawArtifacts, ({ one, many }) => ({
  connection: one(connections, {
    fields: [rawArtifacts.connectionId],
    references: [connections.id],
  }),
  parserRuns: many(parserRuns),
}));

export const parserDefinitionsRelations = relations(parserDefinitions, ({ many }) => ({
  parserRuns: many(parserRuns),
}));

export const parserRunsRelations = relations(parserRuns, ({ one }) => ({
  rawArtifact: one(rawArtifacts, {
    fields: [parserRuns.rawArtifactId],
    references: [rawArtifacts.id],
  }),
  parserDefinition: one(parserDefinitions, {
    fields: [parserRuns.parserDefinitionId],
    references: [parserDefinitions.id],
  }),
}));
