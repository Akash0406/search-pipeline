/**
 * Per-user state, review queue, exports, transactional outbox, feature flags.
 *
 * Requirements: 35.1, 43.4, 49.1.
 */
import { relations, sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, nullableTimestamp, primaryKeyId, updatedAt } from './_shared.js';
import { users } from './identity.js';
import { opportunities, opportunitySources } from './opportunities.js';
import { rawArtifacts } from './connectors.js';

/**
 * Saved / dismissed state, scoped per user (Req 43). Absence of a row = none.
 * PK `(user_id, opportunity_id)` enforces one state per user/opportunity.
 */
export const opportunityUserState = pgTable(
  'opportunity_user_state',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    /** 'saved' | 'dismissed' (Req 43). */
    state: text('state').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.opportunityId] }),
    index('opportunity_user_state_user_state_idx').on(t.userId, t.state),
  ],
);

/** Invalid / uncertain records requiring adjudication (Req 35, 48). */
export const reviewQueueItems = pgTable(
  'review_queue_items',
  {
    id: primaryKeyId(),
    /** 'invalid_record' | 'uncertain_duplicate' | 'closure_ambiguous'. */
    kind: text('kind').notNull(),
    /** artifact retained (Req 35.2). */
    rawArtifactId: uuid('raw_artifact_id').references(() => rawArtifacts.id, {
      onDelete: 'set null',
    }),
    opportunitySourceId: uuid('opportunity_source_id').references(() => opportunitySources.id, {
      onDelete: 'set null',
    }),
    /** failure / adjudication reason (Req 35.3). */
    reason: text('reason'),
    /** 'open' | 'resolved'. */
    status: text('status').notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [index('review_queue_items_status_created_idx').on(t.status, t.createdAt)],
);

/** Data export jobs (Req 49). */
export const exports = pgTable('exports', {
  id: primaryKeyId(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'pending' | 'ready' | 'failed' (Req 49.3). */
  status: text('status').notNull().default('pending'),
  /** signed-URL delivery to the owner only. */
  storageKey: text('storage_key'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Transactional outbox — reliable at-least-once event publishing. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: primaryKeyId(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    correlationId: text('correlation_id'),
    createdAt: createdAt(),
    publishedAt: nullableTimestamp('published_at'),
  },
  (t) => [
    // pending dispatch
    index('outbox_events_pending_idx')
      .on(t.createdAt)
      .where(sql`${t.publishedAt} is null`),
  ],
);

/** Config-driven toggles (incl. future connector modes). */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  payload: jsonb('payload'),
});

// -- Relations -------------------------------------------------------------

export const opportunityUserStateRelations = relations(opportunityUserState, ({ one }) => ({
  user: one(users, { fields: [opportunityUserState.userId], references: [users.id] }),
  opportunity: one(opportunities, {
    fields: [opportunityUserState.opportunityId],
    references: [opportunities.id],
  }),
}));

export const reviewQueueItemsRelations = relations(reviewQueueItems, ({ one }) => ({
  rawArtifact: one(rawArtifacts, {
    fields: [reviewQueueItems.rawArtifactId],
    references: [rawArtifacts.id],
  }),
  opportunitySource: one(opportunitySources, {
    fields: [reviewQueueItems.opportunitySourceId],
    references: [opportunitySources.id],
  }),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  user: one(users, { fields: [exports.userId], references: [users.id] }),
}));
