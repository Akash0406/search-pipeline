/**
 * Shared column builders and conventions used across the schema.
 *
 * Conventions (design → Data Models):
 * - Primary keys are `uuid` defaulting to `gen_random_uuid()`.
 * - `created_at` / `updated_at` are `timestamptz not null default now()`.
 *   (`updated_at` is trigger-maintained at the DB layer; the default keeps
 *   inserts valid and repositories bump it on write.)
 */
import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `bytea` column type (drizzle-orm has no built-in bytea). Used for
 * KMS-encrypted OAuth token blobs on `accounts`.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Standard primary key: `uuid pk default gen_random_uuid()`. */
export const primaryKeyId = () => uuid('id').primaryKey().defaultRandom();

/** `created_at timestamptz not null default now()`. */
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** `updated_at timestamptz not null default now()` (trigger-maintained). */
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** A nullable `timestamptz` column with the given name. */
export const nullableTimestamp = (name: string) => timestamp(name, { withTimezone: true });

/** A non-null `timestamptz` column with the given name. */
export const requiredTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull();

/** Raw SQL default for `now()` (used where a builder default is not convenient). */
export const NOW = sql`now()`;
