-- ─────────────────────────────────────────────────────────────
-- br03_classroom_seat.sql
-- Rule: BR3 — Classroom Seating Mode (General Admission Only)
-- Mechanism: Trigger fn_check_ticket_venue_seating_and_capacity
-- Expected error: P0001 (raise_exception)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Venue 2 is a CLASSROOM (Lecture Hall 101).
    -- Attempting to book a ticket for Show 3 with explicit row_label and seat_no
    -- must be blocked by the trigger.
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (3, 3, 2, 'A', 1, 'FACULTY', 50.00, 'HELD');

    RAISE EXCEPTION 'TEST FAILED: Assigned a seat number in a general admission classroom!';
EXCEPTION
    WHEN raise_exception THEN
        RAISE NOTICE '✓ PASS: Classroom seat assignment rejected by BR3 trigger.';
END;
$$;
