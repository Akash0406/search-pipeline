/**
 * Migration runner — applies the generated Drizzle migrations against the
 * target database (`DATABASE_URL`).
 *
 * Invoked by `pnpm --filter @careerstack/database run migrate`, which is what
 * `infra/scripts/migrate.sh` calls. Safe to run repeatedly (Drizzle tracks
 * applied migrations in `drizzle.__drizzle_migrations`).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Migrations live at the package root (`packages/database/migrations`).
const migrationsFolder = resolve(__dirname, '../migrations');

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log(`[migrate] Applying migrations from ${migrationsFolder} ...`);
  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] Migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
