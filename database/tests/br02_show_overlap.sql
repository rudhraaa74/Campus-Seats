-- ─────────────────────────────────────────────────────────────
-- br02_show_overlap.sql
-- Rule: BR2 — Venue Availability (No Overlapping Shows)
-- Mechanism: EXCLUDE USING gist (ex_show_venue_overlap)
-- Expected error: 23P01 (exclusion_violation)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Show 1 is scheduled in Venue 1 from 18:00 to 21:00 on 2026-11-10.
    -- Attempting to schedule another show in Venue 1 from 19:00 to 22:00
    -- must be blocked by the GiST exclusion constraint.
    INSERT INTO show (event_id, venue_id, start_time, end_time, status)
    VALUES (2, 1, '2026-11-10 19:00:00+00', '2026-11-10 22:00:00+00', 'SCHEDULED');

    RAISE EXCEPTION 'TEST FAILED: Overlapping show was scheduled in venue 1!';
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE NOTICE '✓ PASS: Show overlap prevented by ex_show_venue_overlap.';
END;
$$;
