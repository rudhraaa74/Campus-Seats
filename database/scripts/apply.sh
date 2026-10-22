#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# database/scripts/apply.sh
# Run all schema files (and optionally seed files) in order.
#
# Usage:
#   ./apply.sh              # schema only
#   ./apply.sh --seed       # schema + seed data
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"

# Load env from root .env if it exists
ROOT_DIR="$(dirname "$DB_DIR")"
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

PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

echo "══ Applying schema ══"
for f in "$DB_DIR"/schema/*.sql; do
  if [ -f "$f" ]; then
    echo "  → $(basename "$f")"
    $PSQL_CMD -f "$f"
  fi
done

if [ "${1:-}" = "--seed" ]; then
  echo ""
  echo "══ Applying seed data ══"
  for f in "$DB_DIR"/seed/*.sql; do
    if [ -f "$f" ]; then
      echo "  → $(basename "$f")"
      $PSQL_CMD -f "$f"
    fi
  done
  echo ""
  echo "══ Generating 500+ record production dataset ══"
  node "$DB_DIR/seed/generate_seed.js"
fi

echo ""
echo "✓ Done"
