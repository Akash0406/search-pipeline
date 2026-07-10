/**
 * Drizzle client factory over `pg` (node-postgres).
 *
 * The client is created from a connection string; callers typically pass
 * `loadConfig().db.databaseUrl` from `@careerstack/config`. A process-wide
 * singleton is exposed via `getDb()` for apps that want a shared pool, while
 * `createDb()` remains available for tests that need an isolated pool.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema/index.js';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface CreateDbOptions {
  /** Postgres connection string (e.g. `config.db.databaseUrl`). */
  connectionString: string;
  /** Extra node-postgres pool options (max connections, ssl, etc.). */
  pool?: Omit<PoolConfig, 'connectionString'>;
}

export interface DbHandle {
  db: Database;
  pool: Pool;
  /** Close the underlying pool (graceful shutdown / test teardown). */
  close: () => Promise<void>;
}

/**
 * Create a new Drizzle client backed by a fresh `pg` pool. The caller owns the
 * returned pool and MUST `close()` it on shutdown.
 */
export function createDb(options: CreateDbOptions): DbHandle {
  const pool = new Pool({
    connectionString: options.connectionString,
    ...options.pool,
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: () => pool.end(),
  };
}

let singleton: DbHandle | undefined;

/**
 * Return a process-wide shared Drizzle client, creating it on first use.
 * Reads `DATABASE_URL` from the environment when no connection string is given.
 */
export function getDb(connectionString?: string): DbHandle {
  if (!singleton) {
    const url = connectionString ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'getDb() requires a connection string or the DATABASE_URL environment variable.',
      );
    }
    singleton = createDb({ connectionString: url });
  }
  return singleton;
}

/** Close and clear the process-wide client (used in tests / shutdown). */
export async function closeDb(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = undefined;
  }
}
