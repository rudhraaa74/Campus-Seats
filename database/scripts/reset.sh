#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# database/scripts/reset.sh
# Drop and recreate the database, then apply schema + seed.
#
# Usage:
#   ./reset.sh              # reset and apply schema only
#   ./reset.sh --seed       # reset, apply schema, and seed
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$DB_DIR")"

# Load env from root .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5433}"
DB_USER="${POSTGRES_USER:-seatsync}"
DB_NAME="${POSTGRES_DB:-seatsync}"
export PGPASSWORD="${POSTGRES_PASSWORD:-seatsync_dev}"

PSQL_ADMIN="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -v ON_ERROR_STOP=1"

echo "══ Resetting database: $DB_NAME ══"
echo "  → Terminating connections..."
$PSQL_ADMIN -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

echo "  → Dropping database..."
$PSQL_ADMIN -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null

echo "  → Creating database..."
$PSQL_ADMIN -c "CREATE DATABASE $DB_NAME;" > /dev/null

echo ""
"$SCRIPT_DIR/apply.sh" "${1:-}"
