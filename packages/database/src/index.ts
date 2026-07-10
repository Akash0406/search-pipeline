/**
 * `@careerstack/database` — Drizzle schema, migrations and ownership-scoped
 * repositories (the adapter layer over PostgreSQL).
 *
 * Public surface:
 * - `schema` — every table, enum, and relation (also re-exported by name).
 * - `createDb` / `getDb` / `closeDb` — Drizzle client factory over `pg`.
 * - `OwnershipScopedRepository` — the PRIV-006 enforcement base for user-owned
 *   resources (every query is constrained by `WHERE owner = :ownerId`).
 */
export const DATABASE_PACKAGE = '@careerstack/database' as const;

export * as schema from './schema/index.js';
export * from './schema/index.js';

export {
  createDb,
  getDb,
  closeDb,
  type Database,
  type Schema,
  type DbHandle,
  type CreateDbOptions,
} from './client.js';

export {
  OwnershipScopedRepository,
  type OwnershipScopedRepositoryConfig,
} from './repositories/base.js';
