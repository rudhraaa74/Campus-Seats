-- ─────────────────────────────────────────────────────────────
-- br15_second_payment.sql
-- Rule: BR15 — One Successful Payment per Booking
-- Mechanism: Partial UNIQUE index (uq_payment_one_success)
-- Expected error: 23505 (unique_violation)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Booking 1 already has a SUCCESS payment (from seed data).
    -- Attempting to record a second SUCCESS payment for Booking 1
    -- must be blocked by the partial unique index.
    INSERT INTO payment (booking_id, amount, payment_method, status, gateway_ref, paid_at)
    VALUES (1, 350.00, 'UPI', 'SUCCESS', 'DEMO_PAY_001_DUPLICATE', CURRENT_TIMESTAMP);

    RAISE EXCEPTION 'TEST FAILED: Second successful payment was accepted for booking 1!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE '✓ PASS: Second successful payment prevented by uq_payment_one_success.';
END;
$$;
