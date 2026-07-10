/**
 * Drizzle Kit configuration.
 *
 * - `generate` emits SQL migrations into `./migrations` from the schema barrel.
 * - `migrate` / `push` / `studio` use `DATABASE_URL` when a live DB is present.
 *
 * NOTE: the pgvector extension used by `opportunities.embedding` is created by
 * the generated initial migration (see `migrations/*.sql`, which prepends
 * `CREATE EXTENSION IF NOT EXISTS vector;`). Drizzle Kit does not manage the
 * extension automatically.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://careerstack:careerstack@localhost:5432/careerstack',
  },
  strict: true,
  verbose: true,
});
