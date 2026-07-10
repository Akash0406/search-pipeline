# infra — local development stack

Local backing services for CareerStack (CareerRadar AI): PostgreSQL (with
pgvector), Redis, and MinIO (S3-compatible object storage), plus a thin
database migration runner.

These are intended for **local development only**. The credentials in
`.env.example` are non-secret defaults — never reuse them in a shared or
production environment.

## Services

| Service       | Image                    | Purpose                                   | Default host port(s)           |
| ------------- | ------------------------ | ----------------------------------------- | ------------------------------ |
| `postgres`    | `pgvector/pgvector:pg16` | PostgreSQL 16 + pgvector extension        | `5432`                         |
| `redis`       | `redis:7-alpine`         | BullMQ queues + per-domain rate limiter   | `6379`                         |
| `minio`       | `minio/minio:latest`     | S3-compatible raw-artifact object storage | `9000` (API), `9001` (console) |
| `minio-setup` | `minio/mc:latest`        | One-shot: creates the artifact bucket     | —                              |

Data persists in Docker-managed named volumes: `postgres-data`, `redis-data`,
`minio-data`. (Any bind-mounted `infra/**/data/` directories are gitignored.)

## Prerequisites

- Docker with Compose v2 (`docker compose version`)
- pnpm (for running migrations against the stack)

## Configuration

Environment is read from the repo-root `.env`. Copy the example first:

```bash
cp .env.example .env
```

Every variable also has an inline default in `docker-compose.yml`, so the stack
runs even without a `.env` file. The same variable names are consumed by
`packages/config` and `packages/database`, keeping app config and infra in sync.

Key variables:

- `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- `REDIS_URL`, `REDIS_PORT`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`

## Start / stop the stack

From the repo root (convenience scripts):

```bash
pnpm infra:up      # start all services in the background
pnpm infra:logs    # follow logs
pnpm infra:down    # stop and remove containers (named volumes are kept)
```

Or invoke Compose directly:

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml down
```

To wipe local data as well (drops the named volumes):

```bash
docker compose -f infra/docker-compose.yml down -v
```

Check health / readiness:

```bash
docker compose -f infra/docker-compose.yml ps
```

Wait until `postgres`, `redis`, and `minio` report `healthy` and `minio-setup`
has exited `0` (bucket created).

### Endpoints

- Postgres: `postgresql://careerstack:careerstack@localhost:5432/careerstack`
- Redis: `redis://localhost:6379`
- MinIO S3 API: `http://localhost:9000`
- MinIO console: `http://localhost:9001` (login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

## Run database migrations

The runner applies the Drizzle migrations from `@careerstack/database` against
the running Postgres:

```bash
pnpm db:migrate
# or directly:
bash infra/scripts/migrate.sh
```

The script loads `DATABASE_URL` from `.env` (falling back to the compose
default). Until `@careerstack/database` defines its `migrate` script and ships
generated migrations (task 2.x), the runner is a safe no-op that prints
guidance and exits cleanly.

## Validate the Compose file

```bash
docker compose -f infra/docker-compose.yml config
```

This renders and validates the effective configuration (with variable
substitution) without starting anything.

## Notes

- `version:` is intentionally omitted from `docker-compose.yml` (obsolete in
  Compose v2).
- `minio-setup` is a one-shot job — seeing it in `Exited (0)` state is normal.
