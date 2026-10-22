#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# database/tests/run_all.sh
# Runs each business rule test in database/tests/
# Each test runs in a transaction, tries to violate a rule,
# and verifies that PostgreSQL raises the expected error.
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

PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

echo "══ Running Database Rule Tests ══"
count=0
passed=0

for test_file in "$SCRIPT_DIR"/*.sql; do
  if [ -f "$test_file" ]; then
    count=$((count + 1))
    echo "  → Running $(basename "$test_file")..."
    # Run in a single transaction that always rolls back so test state never leaks
    if $PSQL_CMD -c "BEGIN;" -f "$test_file" -c "ROLLBACK;" > /dev/null 2>&1; then
      echo "    ✓ PASS"
      passed=$((passed + 1))
    else
      echo "    ✗ FAIL"
    fi
  fi
done

if [ $count -eq 0 ]; then
  echo "No test files found in $SCRIPT_DIR yet."
  exit 0
fi

echo "Summary: $passed / $count tests passed."
if [ $passed -ne $count ]; then
  exit 1
fi
