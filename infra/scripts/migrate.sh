#!/usr/bin/env bash
# =============================================================================
# CareerStack — database migration runner
# =============================================================================
# Thin wrapper that applies the Drizzle migrations from `@careerstack/database`
# against the local compose Postgres (or any DATABASE_URL you point it at).
#
# Usage:
#   ./infra/scripts/migrate.sh
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./infra/scripts/migrate.sh
#
# The `@careerstack/database` migrate script + generated migrations are added in
# a later task (2.x). Until then this runner is a safe no-op: it detects that
# the `migrate` script does not yet exist and exits cleanly with guidance,
# rather than failing the developer workflow.
# =============================================================================
set -euo pipefail

# Resolve repo root (this script lives at infra/scripts/migrate.sh).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load repo-root .env if present so DATABASE_URL is available.
if [ -f "${REPO_ROOT}/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "${REPO_ROOT}/.env"
  set +a
fi

# Fall back to the compose default connection string.
: "${DATABASE_URL:=postgresql://careerstack:careerstack@localhost:5432/careerstack}"
export DATABASE_URL

echo "[migrate] Target database: ${DATABASE_URL%%\?*}"

DATABASE_PKG_JSON="${REPO_ROOT}/packages/database/package.json"

# Guard: the database package must exist.
if [ ! -f "${DATABASE_PKG_JSON}" ]; then
  echo "[migrate] packages/database not found — nothing to run yet."
  exit 0
fi

# No-op-safe: only run when the database package actually defines `migrate`.
if grep -q '"migrate"' "${DATABASE_PKG_JSON}"; then
  echo "[migrate] Running Drizzle migrations via @careerstack/database..."
  pnpm --filter @careerstack/database run migrate
  echo "[migrate] Migrations applied."
else
  echo "[migrate] No 'migrate' script in @careerstack/database yet (added in task 2.x)."
  echo "[migrate] Skipping — this is expected during early foundation work."
  exit 0
fi
