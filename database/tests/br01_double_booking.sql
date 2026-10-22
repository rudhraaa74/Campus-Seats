-- ─────────────────────────────────────────────────────────────
-- br01_double_booking.sql
-- Rule: BR1 — No Double Booking
-- Mechanism: Partial UNIQUE index (uq_ticket_live_seat)
-- Expected error: 23505 (unique_violation)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_b1 INT;
    v_b2 INT;
BEGIN
    -- Create two independent bookings for Show 1
    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES (2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'CONFIRMED')
    RETURNING booking_id INTO v_b1;

    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES (3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING')
    RETURNING booking_id INTO v_b2;

    -- Seat (Z, 99) in Venue 1 is booked for Booking 1 (ACTIVE)
    -- Note: We use an unreserved seat Row O Seat 1
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (v_b1, 1, 1, 'O', 1, 'GUEST', 250.00, 'ACTIVE');

    -- Attempting to insert another HELD or ACTIVE ticket on the same seat
    -- must be blocked by the DBMS.
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (v_b2, 1, 1, 'O', 1, 'STUDENT', 120.00, 'HELD');

    RAISE EXCEPTION 'TEST FAILED: Double booking was allowed on seat O-1!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE '✓ PASS: Double booking prevented by uq_ticket_live_seat.';
END;
$$;

