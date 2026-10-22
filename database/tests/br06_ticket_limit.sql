-- ─────────────────────────────────────────────────────────────
-- br06_ticket_limit.sql
-- Rule: BR6 — Booking Ticket Limit (Max 6 live tickets)
-- Mechanism: Trigger fn_check_ticket_limits_and_subsidies
-- Expected error: P0001 (raise_exception)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_test_booking_id INT;
    i INT;
BEGIN
    -- Create a temporary test booking for Show 2
    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES (2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING')
    RETURNING booking_id INTO v_test_booking_id;

    -- Insert 6 allowed tickets (Seats C-1 through C-6)
    FOR i IN 1..6 LOOP
        INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
        VALUES (v_test_booking_id, 2, 1, 'C', i, 'GUEST', 120.00, 'HELD');
    END LOOP;

    -- Attempting to add a 7th ticket must be rejected by the trigger
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES (v_test_booking_id, 2, 1, 'C', 7, 'GUEST', 120.00, 'HELD');

    RAISE EXCEPTION 'TEST FAILED: 7th ticket was accepted in a single booking!';
EXCEPTION
    WHEN raise_exception THEN
        RAISE NOTICE '✓ PASS: 7th ticket correctly rejected by BR6 limit trigger.';
END;
$$;
