-- ─────────────────────────────────────────────────────────────
-- 04_functions.sql
-- SeatSync — Stored Procedures & Helper Functions
-- ─────────────────────────────────────────────────────────────

-- EXPIRE_HOLDS(p_show_id INT DEFAULT NULL)
-- Business Rule BR8: A seat hold lasts 5 minutes.
-- If an attendee does not complete payment before hold_expires_at,
-- this function transitions the booking from PENDING -> EXPIRED and
-- transitions its tickets from HELD -> EXPIRED, immediately releasing
-- the seats for other buyers (since uq_ticket_live_seat only indexes HELD and ACTIVE).
--
-- Invocation patterns:
--   1. expire_holds(show_id)  -> called right before viewing seats or creating holds
--                                for a specific show to clear stale locks.
--   2. expire_holds()         -> called every 30 seconds by node-cron as a safety net
--                                to sweep expired holds across the entire system.
--
-- Returns the integer count of bookings expired in the run.
CREATE OR REPLACE FUNCTION expire_holds(p_show_id INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_expired_count INT := 0;
BEGIN
    -- 1. Expire all HELD tickets belonging to lapsed PENDING bookings
    UPDATE ticket t
    SET status = 'EXPIRED'
    FROM booking b
    WHERE t.booking_id = b.booking_id
      AND b.status = 'PENDING'
      AND b.hold_expires_at < CURRENT_TIMESTAMP
      AND (p_show_id IS NULL OR b.show_id = p_show_id)
      AND t.status = 'HELD';

    -- 2. Expire the PENDING bookings themselves
    WITH updated_bookings AS (
        UPDATE booking
        SET status = 'EXPIRED'
        WHERE status = 'PENDING'
          AND hold_expires_at < CURRENT_TIMESTAMP
          AND (p_show_id IS NULL OR show_id = p_show_id)
        RETURNING booking_id
    )
    SELECT COUNT(*) INTO v_expired_count FROM updated_bookings;

    RETURN v_expired_count;
END;
$$;
