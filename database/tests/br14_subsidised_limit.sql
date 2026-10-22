-- ─────────────────────────────────────────────────────────────
-- br14_subsidised_limit.sql
-- Rule: BR14 — Subsidised Ticket Limit (Max 1 per person per show)
-- Mechanism: Trigger fn_check_ticket_limits_and_subsidies
-- Expected error: P0001 (raise_exception)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_test_booking_id INT;
BEGIN
    -- User 2 (Rudhra) already has an ACTIVE STUDENT ticket on Show 1 (from seed data).
    -- Attempting to book a second STUDENT ticket on Show 1 must be rejected.
    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES (2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING')
    RETURNING booking_id INTO v_test_booking_id;

    -- Attempt second subsidised student ticket on Show 1
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (v_test_booking_id, 1, 1, 'B', 5, 'STUDENT', 100.00, 'HELD');

    RAISE EXCEPTION 'TEST FAILED: Second subsidised ticket was allowed for the same attendee!';
EXCEPTION
    WHEN raise_exception THEN
        RAISE NOTICE '✓ PASS: Second subsidised ticket rejected by BR14 trigger.';
END;
$$;
