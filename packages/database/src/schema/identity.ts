/**
 * Identity, sessions, preferences, and audit schema (Capability B).
 *
 * Requirements: 4.4, 4.5, 5.4, 6.1, 8.1, 9.4, 28.1.
 *
 * Hard invariants encoded here:
 * - `accounts` NEVER has a password column (Req 4.5, 28) — third-party
 *   passwords are never accepted or stored.
 * - `magic_link_tokens` stores only a token HASH, single-use via `used_at`,
 *   and an `expires_at` bounded to ≤ 15 minutes by the application (Req 5.4).
 * - `audit_logs` is APPEND-ONLY (Req 9.4): the application DB role is granted
 *   INSERT/SELECT only (no UPDATE/DELETE). See the generated migration.
 */
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  bytea,
  createdAt,
  nullableTimestamp,
  primaryKeyId,
  requiredTimestamp,
  updatedAt,
} from './_shared.js';
import { roleProfiles } from './role-profiles.js';

/**
 * `users` — the platform end user.
 * `email` is stored as text with a case-insensitive unique index (see the
 * migration); the design's "citext" intent is honored via normalization at the
 * repository layer plus the unique constraint.
 */
export const users = pgTable(
  'users',
  {
    id: primaryKeyId(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    emailVerifiedAt: nullableTimestamp('email_verified_at'),
    /** 'user' | 'admin' (Req 8). */
    role: text('role').notNull().default('user'),
    /** 'active' | 'deleted' (Req 7, 50). */
    status: text('status').notNull().default('active'),
    /** UX date rule — timestamps shown in the user's timezone (Req 6.4, 46.3). */
    timezone: text('timezone'),
    /** Set when personal data is irreversibly anonymized (Req 7, 50). */
    anonymizedAt: nullableTimestamp('anonymized_at'),
    deletedAt: nullableTimestamp('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

/**
 * `accounts` — external OAuth identities (Req 4.4). NO password column exists.
 * Token columns are KMS-encrypted `bytea` and nullable; `scopes` records the
 * granted scopes so scope-minimization can be audited (Req 52).
 */
export const accounts = pgTable(
  'accounts',
  {
    id: primaryKeyId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** e.g. 'google'. */
    provider: text('provider').notNull(),
    /** Verified subject id from the provider (Req 4.4). */
    providerAccountId: text('provider_account_id').notNull(),
    /** KMS-encrypted; minimal scope (Req 52); nullable. */
    accessTokenEnc: bytea('access_token_enc'),
    refreshTokenEnc: bytea('refresh_token_enc'),
    /** Granted scopes, recorded to enforce minimization. */
    scopes: text('scopes').array(),
    connectedAt: nullableTimestamp('connected_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('accounts_provider_account_unique').on(t.provider, t.providerAccountId),
    index('accounts_user_id_idx').on(t.userId),
  ],
);

/**
 * `magic_link_tokens` — passwordless email sign-in (Req 5). Stores only the
 * token HASH (never the raw token), is single-use (`used_at`) and time-limited
 * (`expires_at`, ≤ created_at + 15m enforced by the app, Req 5.4).
 */
export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: primaryKeyId(),
    /** Null for a first sign-in where the user does not yet exist. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** Hash only (Req 5). */
    tokenHash: text('token_hash').notNull(),
    /** ≤ created_at + 15m (Req 5.4). */
    expiresAt: requiredTimestamp('expires_at'),
    /** Single-use marker (Req 5.3). */
    usedAt: nullableTimestamp('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('magic_link_tokens_token_hash_unique').on(t.tokenHash),
    index('magic_link_tokens_email_idx').on(t.email),
  ],
);

/**
 * `sessions` — server-side sessions referenced by an HttpOnly cookie (Req 6).
 * The raw token lives only in the cookie; `token_hash` is stored here.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryKeyId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    /** Hash of the IP, not the raw IP (privacy). */
    ipHash: text('ip_hash'),
    approxLocation: text('approx_location'),
    lastActiveAt: requiredTimestamp('last_active_at'),
    /** Rotation lineage (AUTH-003). */
    rotatedFrom: uuid('rotated_from'),
    /** Revocation (Req 6.2 / 6.3). */
    revokedAt: nullableTimestamp('revoked_at'),
    expiresAt: requiredTimestamp('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_user_revoked_idx').on(t.userId, t.revokedAt),
  ],
);

/**
 * `user_preferences` — per-user settings. `active_role_profile_id` is the
 * SINGLE SOURCE OF TRUTH for the "exactly one active profile" invariant
 * (Req 10.2). `raw_retention_days` overrides the global retention (Req 53.1).
 */
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'light' | 'dark' | 'system' (Req 3.5). */
  theme: text('theme').notNull().default('system'),
  timezone: text('timezone'),
  /** Exactly one active profile per user (Req 10.2). */
  activeRoleProfileId: uuid('active_role_profile_id').references(() => roleProfiles.id, {
    onDelete: 'set null',
  }),
  /** Per-user override of the raw-artifact retention window (Req 53.1). */
  rawRetentionDays: integer('raw_retention_days'),
  updatedAt: updatedAt(),
});

/**
 * `audit_logs` — APPEND-ONLY auth + admin event log (Req 9.4).
 * The application DB role is granted INSERT/SELECT only; UPDATE/DELETE are
 * revoked in the migration so events are not editable through standard actions.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryKeyId(),
    /** Attributable to an account; nullable for failed email sign-ins. */
    userId: uuid('user_id'),
    /** 'user' | 'admin' | 'system'. */
    actor: text('actor'),
    /**
     * login_success | login_failure | session_created | session_revoked |
     * account_deleted | admin_access.
     */
    eventType: text('event_type').notNull(),
    /** 'google' | 'magic_link'. */
    method: text('method'),
    outcome: text('outcome'),
    /** Resource touched (e.g. 'review-queue'). */
    targetRef: text('target_ref'),
    metadata: jsonb('metadata'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_user_created_idx').on(t.userId, t.createdAt)],
);

// -- Relations -------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  magicLinkTokens: many(magicLinkTokens),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
  activeRoleProfile: one(roleProfiles, {
    fields: [userPreferences.activeRoleProfileId],
    references: [roleProfiles.id],
  }),
}));
