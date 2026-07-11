/**
 * Role-profile schema (Capability C).
 *
 * Requirements: 10.1, 11.3, 12.3, 13.3, 14.3, 15.2, 16.1.
 *
 * Design notes:
 * - Titles / skills / locations are CHILD TABLES (not JSONB): they are queried
 *   and filtered relationally by the explorer and future matching, benefit from
 *   indexing/integrity, and stay small per user.
 * - Scalar preference SETS (work arrangements / employment types / seniority)
 *   live in the singleton-per-profile `role_profile_preferences`.
 * - The "exactly one active profile" invariant is modelled by
 *   `user_preferences.active_role_profile_id` (single source of truth), so this
 *   table only carries an active/paused lifecycle `status`.
 * - `salary_*` are nullable: unspecified != 0 (Req 15.3).
 * - `work_rights` is optional and PRIVATE (Req 16); null = unspecified.
 */
import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryKeyId, updatedAt } from './_shared.js';
import { users } from './identity.js';

/** A named set of a user's career preferences (Req 10). */
export const roleProfiles = pgTable(
  'role_profiles',
  {
    id: primaryKeyId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 'active' | 'paused' (Req 18). */
    status: text('status').notNull().default('active'),
    /** Optional; unspecified != 0 (Req 15.3). */
    salaryMin: numeric('salary_min'),
    salaryMax: numeric('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period'),
    /** Optional, PRIVATE (Req 16); null = unspecified. */
    workRights: jsonb('work_rights'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('role_profiles_user_id_idx').on(t.userId)],
);

/** Target / excluded job titles (Req 11). */
export const roleProfileTitles = pgTable(
  'role_profile_titles',
  {
    id: primaryKeyId(),
    roleProfileId: uuid('role_profile_id')
      .notNull()
      .references(() => roleProfiles.id, { onDelete: 'cascade' }),
    /** 'target' | 'excluded' (Req 11). */
    kind: text('kind').notNull(),
    value: text('value').notNull(),
  },
  (t) => [index('role_profile_titles_profile_kind_idx').on(t.roleProfileId, t.kind)],
);

/** Required / preferred skills (Req 12). */
export const roleProfileSkills = pgTable(
  'role_profile_skills',
  {
    id: primaryKeyId(),
    roleProfileId: uuid('role_profile_id')
      .notNull()
      .references(() => roleProfiles.id, { onDelete: 'cascade' }),
    /** 'required' | 'preferred' (Req 12). */
    kind: text('kind').notNull(),
    value: text('value').notNull(),
  },
  (t) => [index('role_profile_skills_profile_kind_idx').on(t.roleProfileId, t.kind)],
);

/** Preferred locations (Req 13). */
export const roleProfileLocations = pgTable(
  'role_profile_locations',
  {
    id: primaryKeyId(),
    roleProfileId: uuid('role_profile_id')
      .notNull()
      .references(() => roleProfiles.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [index('role_profile_locations_profile_idx').on(t.roleProfileId)],
);

/**
 * Singleton-per-profile scalar preference sets (Req 13.2, 14).
 * `work_arrangements` ⊆ {on_site, hybrid, remote}.
 */
export const roleProfilePreferences = pgTable('role_profile_preferences', {
  roleProfileId: uuid('role_profile_id')
    .primaryKey()
    .references(() => roleProfiles.id, { onDelete: 'cascade' }),
  workArrangements: text('work_arrangements').array(),
  employmentTypes: text('employment_types').array(),
  seniorityLevels: text('seniority_levels').array(),
});

// -- Relations -------------------------------------------------------------

export const roleProfilesRelations = relations(roleProfiles, ({ one, many }) => ({
  user: one(users, { fields: [roleProfiles.userId], references: [users.id] }),
  titles: many(roleProfileTitles),
  skills: many(roleProfileSkills),
  locations: many(roleProfileLocations),
  preferences: one(roleProfilePreferences, {
    fields: [roleProfiles.id],
    references: [roleProfilePreferences.roleProfileId],
  }),
}));

export const roleProfileTitlesRelations = relations(roleProfileTitles, ({ one }) => ({
  roleProfile: one(roleProfiles, {
    fields: [roleProfileTitles.roleProfileId],
    references: [roleProfiles.id],
  }),
}));

export const roleProfileSkillsRelations = relations(roleProfileSkills, ({ one }) => ({
  roleProfile: one(roleProfiles, {
    fields: [roleProfileSkills.roleProfileId],
    references: [roleProfiles.id],
  }),
}));

export const roleProfileLocationsRelations = relations(roleProfileLocations, ({ one }) => ({
  roleProfile: one(roleProfiles, {
    fields: [roleProfileLocations.roleProfileId],
    references: [roleProfiles.id],
  }),
}));

export const roleProfilePreferencesRelations = relations(roleProfilePreferences, ({ one }) => ({
  roleProfile: one(roleProfiles, {
    fields: [roleProfilePreferences.roleProfileId],
    references: [roleProfiles.id],
  }),
}));
