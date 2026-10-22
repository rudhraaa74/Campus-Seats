#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# database/scripts/demo_constraints.sh
# SeatSync — Live Business Rules & Constraints Enforcement Demo
# ─────────────────────────────────────────────────────────────
# Demonstrates DBMS constraint enforcement live against PostgreSQL:
# 1. BR1: Double Booking (Partial UNIQUE index on live tickets)
# 2. BR2: Venue Show Overlap (GiST EXCLUDE constraint)
# 3. BR3: Classroom Physical Seat Restriction (CHECK / Trigger)
# 4. BR6: 7th Ticket in Single Booking (Trigger limit)
# 5. BR15: Second Successful Payment (Partial UNIQUE index)
# ─────────────────────────────────────────────────────────────

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"
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

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     SeatSync — Live PostgreSQL Constraint Enforcement Demo       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo -e "Connecting to database: ${BOLD}$DB_NAME${NC} on ${BOLD}$DB_HOST:$DB_PORT${NC}\n"

passed_count=0
total_count=5

# ─────────────────────────────────────────────────────────────
# DEMO 1: RULE BR1 — DOUBLE BOOKING PREVENTION
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}1. Rule BR1 — Double Booking Prevention${NC}"
echo -e "   ${YELLOW}Enforcement:${NC} Partial UNIQUE index on active/held tickets per show & seat"
echo -e "   ${YELLOW}Attempt:${NC} Inserting two live tickets for the exact same seat (Auditorium, Row J, Seat 15, Show 1)"

output1=$($PSQL -c "
BEGIN;
INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
VALUES (1, 1, 1, 'J', 15, 'STUDENT', 120.00, 'ACTIVE');
INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
VALUES (2, 1, 1, 'J', 15, 'STUDENT', 120.00, 'ACTIVE');
ROLLBACK;
" 2>&1 || true)

if echo "$output1" | grep -qi "uq_ticket_live_seat\|idx_ticket_active_seat\|unique constraint"; then
  echo -e "   ${GREEN}✓ REJECTED BY POSTGRESQL AS EXPECTED${NC}"
  echo -e "   ${CYAN}DBMS Error Message:${NC} $(echo "$output1" | grep -i "ERROR:" | head -n 1)"
  passed_count=$((passed_count + 1))
else
  echo -e "   ${RED}✗ FAILED TO REJECT${NC}: $output1"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# DEMO 2: RULE BR2 — VENUE SHOW TIME OVERLAP PREVENTION
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}2. Rule BR2 — Venue Show Overlap Prevention${NC}"
echo -e "   ${YELLOW}Enforcement:${NC} GiST EXCLUDE constraint (ex_show_venue_overlap) with tsrange"
echo -e "   ${YELLOW}Attempt:${NC} Scheduling a conflicting show in Main Auditorium (2026-11-10 19:00 to 22:00, overlapping Show 1 18:00 to 21:00)"

output2=$($PSQL -c "
BEGIN;
INSERT INTO show (event_id, venue_id, start_time, end_time, status)
VALUES (2, 1, '2026-11-10 19:00:00+00', '2026-11-10 22:00:00+00', 'SCHEDULED');
ROLLBACK;
" 2>&1 || true)

if echo "$output2" | grep -qi "ex_show_venue_overlap\|exclusion constraint"; then
  echo -e "   ${GREEN}✓ REJECTED BY POSTGRESQL AS EXPECTED${NC}"
  echo -e "   ${CYAN}DBMS Error Message:${NC} $(echo "$output2" | grep -i "ERROR:" | head -n 1)"
  passed_count=$((passed_count + 1))
else
  echo -e "   ${RED}✗ FAILED TO REJECT${NC}: $output2"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# DEMO 3: RULE BR3 — CLASSROOM PHYSICAL SEAT RESTRICTION
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}3. Rule BR3 — Classroom Physical Seat Coordinates Restriction${NC}"
echo -e "   ${YELLOW}Enforcement:${NC} CHECK constraint (ck_ticket_classroom_null_seat) & Trigger"
echo -e "   ${YELLOW}Attempt:${NC} Assigning a physical row/seat (Row A, Seat 1) to a General Admission Classroom ticket"

output3=$($PSQL -c "
BEGIN;
INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
VALUES (1, 5, 2, 'A', 1, 'STUDENT', 20.00, 'ACTIVE');
ROLLBACK;
" 2>&1 || true)

if echo "$output3" | grep -qi "ck_ticket_classroom_null_seat\|category\|seats cannot be created in classrooms"; then
  echo -e "   ${GREEN}✓ REJECTED BY POSTGRESQL AS EXPECTED${NC}"
  echo -e "   ${CYAN}DBMS Error Message:${NC} $(echo "$output3" | grep -i "ERROR:" | head -n 1)"
  passed_count=$((passed_count + 1))
else
  echo -e "   ${RED}✗ FAILED TO REJECT${NC}: $output3"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# DEMO 4: RULE BR6 — MAXIMUM 6 TICKETS PER BOOKING
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}4. Rule BR6 — Ticket Booking Limit (Max 6 Live Tickets)${NC}"
echo -e "   ${YELLOW}Enforcement:${NC} BEFORE INSERT/UPDATE trigger fn_check_ticket_limits()"
echo -e "   ${YELLOW}Attempt:${NC} Inserting a 7th ticket into a single booking reservation"

output4=$($PSQL -c "
DO \$\$
DECLARE
    v_b_id INT;
    i INT;
BEGIN
    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES (2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING')
    RETURNING booking_id INTO v_b_id;

    FOR i IN 1..6 LOOP
        INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
        VALUES (v_b_id, 2, 1, 'G', i, 'STUDENT', 80.00, 'HELD');
    END LOOP;

    -- 7th ticket must be rejected
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (v_b_id, 2, 1, 'G', 7, 'STUDENT', 80.00, 'HELD');
END;
\$\$;
" 2>&1 || true)

if echo "$output4" | grep -qi "more than 6 live tickets\|ticket limit"; then
  echo -e "   ${GREEN}✓ REJECTED BY POSTGRESQL AS EXPECTED${NC}"
  echo -e "   ${CYAN}DBMS Error Message:${NC} $(echo "$output4" | grep -i "ERROR:" | head -n 1)"
  passed_count=$((passed_count + 1))
else
  echo -e "   ${RED}✗ FAILED TO REJECT${NC}: $output4"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# DEMO 5: RULE BR15 — SECOND SUCCESSFUL PAYMENT PREVENTION
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}5. Rule BR15 — Single Successful Payment Per Booking${NC}"
echo -e "   ${YELLOW}Enforcement:${NC} Partial UNIQUE index (uq_payment_one_success) on status = 'SUCCESS'"
echo -e "   ${YELLOW}Attempt:${NC} Inserting a duplicate SUCCESS payment for an already paid booking"

output5=$($PSQL -c "
BEGIN;
INSERT INTO payment (booking_id, amount, payment_method, status, gateway_ref, paid_at)
VALUES (1, 100.00, 'UPI', 'SUCCESS', 'GATEWAY_TEST_DUP_1', CURRENT_TIMESTAMP);
INSERT INTO payment (booking_id, amount, payment_method, status, gateway_ref, paid_at)
VALUES (1, 100.00, 'UPI', 'SUCCESS', 'GATEWAY_TEST_DUP_2', CURRENT_TIMESTAMP);
ROLLBACK;
" 2>&1 || true)

if echo "$output5" | grep -qi "uq_payment_one_success\|idx_payment_one_success\|unique constraint"; then
  echo -e "   ${GREEN}✓ REJECTED BY POSTGRESQL AS EXPECTED${NC}"
  echo -e "   ${CYAN}DBMS Error Message:${NC} $(echo "$output5" | grep -i "ERROR:" | head -n 1)"
  passed_count=$((passed_count + 1))
else
  echo -e "   ${RED}✗ FAILED TO REJECT${NC}: $output5"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
if [ $passed_count -eq $total_count ]; then
  echo -e "${GREEN}${BOLD}✓ ALL $passed_count / $total_count CONSTRAINTS LIVE-VERIFIED & ENFORCED BY DBMS!${NC}"
else
  echo -e "${RED}${BOLD}✗ Only $passed_count / $total_count constraints were enforced.${NC}"
fi
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}\n"
