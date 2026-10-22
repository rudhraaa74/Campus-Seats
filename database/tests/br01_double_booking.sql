-- ─────────────────────────────────────────────────────────────
-- br01_double_booking.sql
-- Rule: BR1 — No Double Booking
-- Mechanism: Partial UNIQUE index (uq_ticket_live_seat)
-- Expected error: 23505 (unique_violation)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Seat (A, 1) in Venue 1 is already ACTIVE for Show 1 (from seed data).
    -- Attempting to insert another HELD or ACTIVE ticket on the same seat
    -- must be blocked by the DBMS.
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (2, 1, 1, 'A', 1, 'GUEST', 250.00, 'HELD');

    RAISE EXCEPTION 'TEST FAILED: Double booking was allowed on seat A-1!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE '✓ PASS: Double booking prevented by uq_ticket_live_seat.';
END;
$$;
