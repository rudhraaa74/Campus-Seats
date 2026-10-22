-- ─────────────────────────────────────────────────────────────
-- 03_indexes.sql
-- SeatSync — Integrity Constraints, Partial Indexes & Search Indexes
-- ─────────────────────────────────────────────────────────────

-- 1. BR1: NO DOUBLE BOOKING
-- A seat in an auditorium can have at most one live (HELD or ACTIVE) ticket
-- per show.
-- Cancelled and Expired tickets remain in the table for historical and audit
-- purposes, but the partial predicate ensures they never block future bookings.
-- Only applies to auditorium tickets where row_label and seat_no are present.
CREATE UNIQUE INDEX uq_ticket_live_seat
ON ticket (show_id, venue_id, row_label, seat_no)
WHERE status IN ('HELD', 'ACTIVE')
  AND row_label IS NOT NULL
  AND seat_no IS NOT NULL;

-- 2. BR2: VENUE AVAILABILITY (NO OVERLAPPING SHOWS)
-- Two non-cancelled shows in the same venue cannot overlap in time.
-- Uses GiST indexing with the btree_gist extension.
-- The half-open range '[)' ensures that a show can start at the exact minute
-- another show ends (e.g. 18:00–20:00 and 20:00–22:00 do not overlap).
-- Cancelled shows are excluded so their time slots become immediately available.
ALTER TABLE show
ADD CONSTRAINT ex_show_venue_overlap
EXCLUDE USING gist (
    venue_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status <> 'CANCELLED');

-- 3. BR15: ONE SUCCESSFUL PAYMENT PER BOOKING
-- A booking can have multiple failed payment attempts, but at most ONE
-- successful payment transaction.
CREATE UNIQUE INDEX uq_payment_one_success
ON payment (booking_id)
WHERE status = 'SUCCESS';

-- 4. SEARCH & FOREIGN KEY PERFORMANCE INDEXES
-- Index for finding and ordering upcoming shows by date/time
CREATE INDEX idx_show_start_time
ON show (start_time);

-- Index for retrieving all shows associated with an event
CREATE INDEX idx_show_event
ON show (event_id);

-- Index for retrieving all tickets within a booking
CREATE INDEX idx_ticket_booking
ON ticket (booking_id);

-- Index for checking tickets and seat statuses per show
CREATE INDEX idx_ticket_show
ON ticket (show_id);

-- Index for attendee booking history ("My Bookings" page)
CREATE INDEX idx_booking_user
ON booking (user_id);

-- Index for expiring pending holds
-- Highly optimizes the 30-second cron job query running expire_holds():
--   SELECT ... FROM booking WHERE status = 'PENDING' AND hold_expires_at < CURRENT_TIMESTAMP
CREATE INDEX idx_booking_status_expiry
ON booking (status, hold_expires_at)
WHERE status = 'PENDING';

-- Index for event filtering by organizing club
CREATE INDEX idx_event_club
ON event (club_id);

-- Index for event filtering by category/type
CREATE INDEX idx_event_type
ON event (event_type);

