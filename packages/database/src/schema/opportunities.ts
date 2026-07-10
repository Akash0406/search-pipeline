/**
 * Canonical opportunity model & provenance (Capability F).
 *
 * Requirements: 32.1, 33.2, 33.3, 34.1, 36.1, 37.1, 39.2, 58.3.
 *
 * Key invariants:
 * - `match_features` (jsonb) and `embedding` (pgvector, 1536) are RESERVED for
 *   future match/analysis specs. They are DECLARED here but NEVER written in
 *   this slice (Req 33.3, 45.5).
 * - Full description lives in `opportunity_content` and is kept OUT of list
 *   responses (Req 33.4, 40.3, 58.3) — the explorer projects without it.
 * - `opportunity_sources` carries `unique(source_type, external_id)` for
 *   exact-identity dedup (OPP-005.1); provenance is preserved after merge.
 * - Explorer indexes: `(status, last_updated_at desc)` primary sort,
 *   `(company)`, partial `(closing_at) where not null`, `(first_seen_at)`,
 *   `(fingerprint)`.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  createdAt,
  nullableTimestamp,
  primaryKeyId,
  requiredTimestamp,
  updatedAt,
} from './_shared.js';
import { sourceTypeEnum, extractionMethodEnum, opportunityStatusEnum } from './enums.js';
import { rawArtifacts } from './connectors.js';

/** The single deduplicated representation of a job opportunity (Req 33). */
export const opportunities = pgTable(
  'opportunities',
  {
    id: primaryKeyId(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    /** resolved canonical URL (dedup / identity). */
    canonicalUrl: text('canonical_url'),
    applyUrl: text('apply_url'),
    /** normalized enum values (Req 33.2). */
    workArrangement: text('work_arrangement'),
    employmentType: text('employment_type'),
    seniority: text('seniority'),
    salaryMin: numeric('salary_min'),
    salaryMax: numeric('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period'),
    postedAt: nullableTimestamp('posted_at'),
    firstSeenAt: requiredTimestamp('first_seen_at'),
    closingAt: nullableTimestamp('closing_at'),
    /** surfaced for sort (Req 39.3). */
    lastUpdatedAt: requiredTimestamp('last_updated_at'),
    status: opportunityStatusEnum('status').notNull().default('New'),
    isFirstParty: boolean('is_first_party').notNull().default(false),
    /** normalized-fingerprint dedup key. */
    fingerprint: text('fingerprint'),
    /** of canonical content for change detection (Req 39). */
    contentHash: text('content_hash'),
    duplicateGroupId: uuid('duplicate_group_id').references(
      (): AnyPgColumn => duplicateGroups.id,
      { onDelete: 'set null' },
    ),
    // --- RESERVED, unused this slice (Req 33.3, 45.5) ---
    /** reserved for future match/analysis. NEVER written this slice. */
    matchFeatures: jsonb('match_features'),
    /** pgvector, reserved for future matching. NEVER written this slice. */
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('opportunities_canonical_url_unique').on(t.canonicalUrl),
    index('opportunities_status_idx').on(t.status),
    index('opportunities_company_idx').on(t.company),
    index('opportunities_posted_at_idx').on(t.postedAt),
    index('opportunities_first_seen_at_idx').on(t.firstSeenAt),
    index('opportunities_last_updated_at_idx').on(t.lastUpdatedAt),
    index('opportunities_fingerprint_idx').on(t.fingerprint),
    // primary explorer sort (Req 41, 42, 58)
    index('opportunities_status_last_updated_idx').on(t.status, t.lastUpdatedAt.desc()),
    index('opportunities_company_status_idx').on(t.company, t.status),
    // partial index for open statuses on last_updated_at desc
    index('opportunities_active_last_updated_idx')
      .on(t.lastUpdatedAt.desc())
      .where(sql`${t.status} in ('New','Active','Closing soon')`),
    // partial index on closing_at where present
    index('opportunities_closing_at_idx')
      .on(t.closingAt)
      .where(sql`${t.closingAt} is not null`),
  ],
);

/** Structured locations for an opportunity (Req 33.2). */
export const opportunityLocations = pgTable(
  'opportunity_locations',
  {
    id: primaryKeyId(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    normalizedValue: text('normalized_value'),
    city: text('city'),
    region: text('region'),
    country: text('country'),
    isRemote: boolean('is_remote'),
  },
  (t) => [
    index('opportunity_locations_opportunity_idx').on(t.opportunityId),
    index('opportunity_locations_normalized_idx').on(t.normalizedValue),
    index('opportunity_locations_geo_idx').on(t.country, t.region, t.city),
  ],
);

/** Free-text requirements extracted for an opportunity. */
export const opportunityRequirements = pgTable('opportunity_requirements', {
  id: primaryKeyId(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
});

/** Skills extracted for an opportunity. */
export const opportunitySkills = pgTable(
  'opportunity_skills',
  {
    id: primaryKeyId(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    /** nullable; reserved for future extraction. */
    kind: text('kind'),
  },
  (t) => [index('opportunity_skills_opportunity_idx').on(t.opportunityId)],
);

/**
 * Full description — kept OUT of list responses (Req 33.4, 40.3, 58.3).
 * Sanitized HTML is NEVER rendered raw (XSS defense).
 */
export const opportunityContent = pgTable('opportunity_content', {
  opportunityId: uuid('opportunity_id')
    .primaryKey()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  descriptionHtmlSanitized: text('description_html_sanitized'),
  descriptionText: text('description_text'),
});

/** Links a canonical opportunity to a source/artifact — traceability (Req 37). */
export const opportunitySources = pgTable(
  'opportunity_sources',
  {
    id: primaryKeyId(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    /** preserved reference (Req 37.3). */
    rawArtifactId: uuid('raw_artifact_id').references(() => rawArtifacts.id, {
      onDelete: 'set null',
    }),
    sourceType: sourceTypeEnum('source_type').notNull(),
    /** first-party-wins + UX marker (Req 21.4, 45.3). */
    isFirstParty: boolean('is_first_party').notNull(),
    /** exact-identity dedup input (Req 36). */
    externalId: text('external_id'),
    sourceUrl: text('source_url'),
    applyUrl: text('apply_url'),
    atsBoard: text('ats_board'),
    atsPostingId: text('ats_posting_id'),
    /** normalized-fingerprint dedup input. */
    fingerprint: text('fingerprint'),
    confidence: numeric('confidence'),
    createdAt: createdAt(),
  },
  (t) => [
    index('opportunity_sources_opportunity_idx').on(t.opportunityId),
    index('opportunity_sources_fingerprint_idx').on(t.fingerprint),
    // exact-identity guard (OPP-005.1)
    uniqueIndex('opportunity_sources_type_external_unique').on(t.sourceType, t.externalId),
  ],
);

/** Provenance per extracted fact (Req 34, 45.2). */
export const opportunityEvidence = pgTable(
  'opportunity_evidence',
  {
    id: primaryKeyId(),
    opportunitySourceId: uuid('opportunity_source_id')
      .notNull()
      .references(() => opportunitySources.id, { onDelete: 'cascade' }),
    /** e.g. 'salary', 'title', 'closingAt'. */
    field: text('field').notNull(),
    valueJson: jsonb('value_json'),
    sourceText: text('source_text'),
    /** STRUCTURED_DATA | RULE | PARSER | LLM | USER (Req 34.2). */
    method: extractionMethodEnum('method').notNull(),
    confidence: numeric('confidence').notNull(),
    /** (Req 34.4). */
    uncertain: boolean('uncertain').notNull().default(false),
  },
  (t) => [index('opportunity_evidence_source_idx').on(t.opportunitySourceId)],
);

/** Change history for a canonical opportunity (Req 39). */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: primaryKeyId(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    changedAt: requiredTimestamp('changed_at'),
    /** which canonical fields changed (Req 39.2). */
    changedFields: text('changed_fields').array(),
    previousContentHash: text('previous_content_hash'),
    newContentHash: text('new_content_hash'),
    rawArtifactId: uuid('raw_artifact_id').references(() => rawArtifacts.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('content_revisions_opportunity_changed_idx').on(t.opportunityId, t.changedAt)],
);

/** Deduplication grouping (Req 36, 41.4). */
export const duplicateGroups = pgTable('duplicate_groups', {
  id: primaryKeyId(),
  canonicalOpportunityId: uuid('canonical_opportunity_id').references(
    () => opportunities.id,
    { onDelete: 'set null' },
  ),
  /** 'exact' | 'fingerprint' | 'fuzzy'. */
  strategy: text('strategy'),
  confidence: numeric('confidence'),
  createdAt: createdAt(),
});

// -- Relations -------------------------------------------------------------

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  locations: many(opportunityLocations),
  requirements: many(opportunityRequirements),
  skills: many(opportunitySkills),
  content: one(opportunityContent, {
    fields: [opportunities.id],
    references: [opportunityContent.opportunityId],
  }),
  sources: many(opportunitySources),
  revisions: many(contentRevisions),
  duplicateGroup: one(duplicateGroups, {
    fields: [opportunities.duplicateGroupId],
    references: [duplicateGroups.id],
  }),
}));

export const opportunityLocationsRelations = relations(opportunityLocations, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityLocations.opportunityId],
    references: [opportunities.id],
  }),
}));

export const opportunityRequirementsRelations = relations(
  opportunityRequirements,
  ({ one }) => ({
    opportunity: one(opportunities, {
      fields: [opportunityRequirements.opportunityId],
      references: [opportunities.id],
    }),
  }),
);

export const opportunitySkillsRelations = relations(opportunitySkills, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunitySkills.opportunityId],
    references: [opportunities.id],
  }),
}));

export const opportunityContentRelations = relations(opportunityContent, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityContent.opportunityId],
    references: [opportunities.id],
  }),
}));

export const opportunitySourcesRelations = relations(opportunitySources, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [opportunitySources.opportunityId],
    references: [opportunities.id],
  }),
  rawArtifact: one(rawArtifacts, {
    fields: [opportunitySources.rawArtifactId],
    references: [rawArtifacts.id],
  }),
  evidence: many(opportunityEvidence),
}));

export const opportunityEvidenceRelations = relations(opportunityEvidence, ({ one }) => ({
  source: one(opportunitySources, {
    fields: [opportunityEvidence.opportunitySourceId],
    references: [opportunitySources.id],
  }),
}));

export const contentRevisionsRelations = relations(contentRevisions, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [contentRevisions.opportunityId],
    references: [opportunities.id],
  }),
}));

export const duplicateGroupsRelations = relations(duplicateGroups, ({ many }) => ({
  opportunities: many(opportunities),
}));
