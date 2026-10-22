-- ─────────────────────────────────────────────────────────────
-- 05_triggers.sql
-- SeatSync — Business Rule Triggers & Integrity Automation
-- ─────────────────────────────────────────────────────────────
-- All triggers raise descriptive exceptions with ERRCODE = 'P0001'
-- so the Express backend (db/errors.js) directly surfaces the
-- error message to the client with an HTTP 422 status code.
-- ─────────────────────────────────────────────────────────────

-- =============================================================
-- 1. BR3: SEAT & VENUE TYPE RULES
-- =============================================================

-- BR3.1: Physical seats can only be created in AUDITORIUM venues
CREATE OR REPLACE FUNCTION fn_check_seat_venue_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_type VARCHAR(20);
BEGIN
    SELECT venue_type INTO v_type FROM venue WHERE venue_id = NEW.venue_id;
    IF v_type = 'CLASSROOM' THEN
        RAISE EXCEPTION 'Seats cannot be created in classrooms. Classrooms use general admission.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seat_auditorium_only
BEFORE INSERT OR UPDATE ON seat
FOR EACH ROW
EXECUTE FUNCTION fn_check_seat_venue_type();

-- BR3.2: Classrooms can have only ONE seat category ("General")
CREATE OR REPLACE FUNCTION fn_check_classroom_category_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_type VARCHAR(20);
    v_cat_count INT;
BEGIN
    SELECT venue_type INTO v_type FROM venue WHERE venue_id = NEW.venue_id;
    IF v_type = 'CLASSROOM' THEN
        SELECT COUNT(*) INTO v_cat_count FROM seat_category WHERE venue_id = NEW.venue_id;
        IF v_cat_count >= 1 AND (TG_OP = 'INSERT' OR NEW.venue_id <> OLD.venue_id) THEN
            RAISE EXCEPTION 'Classrooms can only have exactly one seat category ("General").'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_classroom_single_category
BEFORE INSERT OR UPDATE ON seat_category
FOR EACH ROW
EXECUTE FUNCTION fn_check_classroom_category_limit();

-- BR3.3: Classroom vs Auditorium ticket rules & Classroom Capacity Check
CREATE OR REPLACE FUNCTION fn_check_ticket_venue_seating_and_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_venue_type VARCHAR(20);
    v_capacity INT;
    v_live_count INT;
BEGIN
    -- Only check live tickets (HELD or ACTIVE)
    IF NEW.status NOT IN ('HELD', 'ACTIVE') THEN
        RETURN NEW;
    END IF;

    SELECT venue_type, capacity INTO v_venue_type, v_capacity
    FROM venue
    WHERE venue_id = NEW.venue_id;

    IF v_venue_type = 'AUDITORIUM' THEN
        -- Auditorium tickets MUST specify an exact seat
        IF NEW.row_label IS NULL OR NEW.seat_no IS NULL THEN
            RAISE EXCEPTION 'Auditorium tickets must specify an exact row and seat number.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_venue_type = 'CLASSROOM' THEN
        -- Classroom tickets MUST NOT specify a seat
        IF NEW.row_label IS NOT NULL OR NEW.seat_no IS NOT NULL THEN
            RAISE EXCEPTION 'Classroom tickets cannot specify seat numbers (general admission only).'
                USING ERRCODE = 'P0001';
        END IF;

        -- Serialize concurrent bookings on this show to prevent overselling
        PERFORM 1 FROM show WHERE show_id = NEW.show_id FOR UPDATE;

        -- Count existing live tickets
        SELECT COUNT(*) INTO v_live_count
        FROM ticket
        WHERE show_id = NEW.show_id
          AND status IN ('HELD', 'ACTIVE')
          AND ticket_id <> COALESCE(NEW.ticket_id, -1);

        IF v_live_count >= v_capacity THEN
            RAISE EXCEPTION 'Show capacity of % has been reached for this venue.' , v_capacity
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_venue_seating_and_capacity
BEFORE INSERT OR UPDATE ON ticket
FOR EACH ROW
EXECUTE FUNCTION fn_check_ticket_venue_seating_and_capacity();

-- =============================================================
-- 2. BR5: TICKET PRICE LOOKUP & FREEZE
-- =============================================================
-- Automatically looks up the price from show_price and freezes
-- it into ticket.price_paid. Future changes to show_price do not
-- affect already issued tickets.
CREATE OR REPLACE FUNCTION fn_ticket_price_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_category_id INT;
    v_price NUMERIC(10, 2);
BEGIN
    -- Determine the category ID
    IF NEW.row_label IS NOT NULL AND NEW.seat_no IS NOT NULL THEN
        -- Auditorium seat: lookup category from seat table
        SELECT category_id INTO v_category_id
        FROM seat
        WHERE venue_id = NEW.venue_id
          AND row_label = NEW.row_label
          AND seat_no = NEW.seat_no;
    ELSE
        -- Classroom: lookup the single General category for the venue
        SELECT category_id INTO v_category_id
        FROM seat_category
        WHERE venue_id = NEW.venue_id
        LIMIT 1;
    END IF;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Could not determine seat category for ticket.'
            USING ERRCODE = 'P0001';
    END IF;

    -- Lookup configured price for (show, category, attendee_type)
    SELECT price INTO v_price
    FROM show_price
    WHERE show_id = NEW.show_id
      AND category_id = v_category_id
      AND user_type = NEW.attendee_type;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Price is not configured for show %, category %, attendee %.' ,
            NEW.show_id, v_category_id, NEW.attendee_type
            USING ERRCODE = 'P0001';
    END IF;

    -- Freeze price paid
    NEW.price_paid := v_price;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_price_freeze
BEFORE INSERT ON ticket
FOR EACH ROW
EXECUTE FUNCTION fn_ticket_price_freeze();

-- =============================================================
-- 3. BR6: TICKET LIMIT (MAX 6 LIVE TICKETS PER BOOKING)
-- =============================================================
CREATE OR REPLACE FUNCTION fn_check_ticket_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking_live_count INT;
BEGIN
    IF NEW.status NOT IN ('HELD', 'ACTIVE') THEN
        RETURN NEW;
    END IF;

    -- BR6: Max 6 live tickets per booking
    SELECT COUNT(*) INTO v_booking_live_count
    FROM ticket
    WHERE booking_id = NEW.booking_id
      AND status IN ('HELD', 'ACTIVE')
      AND ticket_id <> COALESCE(NEW.ticket_id, -1);

    IF v_booking_live_count >= 6 THEN
        RAISE EXCEPTION 'A booking cannot contain more than 6 live tickets.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_limits_and_subsidies ON ticket;
CREATE TRIGGER trg_ticket_limits
BEFORE INSERT OR UPDATE ON ticket
FOR EACH ROW
EXECUTE FUNCTION fn_check_ticket_limits();

-- =============================================================
-- 4. BR7: BOOKING WINDOW VALIDATION
-- =============================================================
-- Bookings can only be created for SCHEDULED shows that have not started.
CREATE OR REPLACE FUNCTION fn_check_booking_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_show_status VARCHAR(20);
    v_start_time TIMESTAMPTZ;
BEGIN
    SELECT status, start_time INTO v_show_status, v_start_time
    FROM show
    WHERE show_id = NEW.show_id;

    IF v_show_status <> 'SCHEDULED' THEN
        RAISE EXCEPTION 'Bookings are only allowed for SCHEDULED shows.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_start_time <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Cannot book a show that has already started.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_window
BEFORE INSERT ON booking
FOR EACH ROW
EXECUTE FUNCTION fn_check_booking_window();

-- =============================================================
-- 5. BR9: USER TYPE VS SUBCLASS CONSISTENCY & LOCKING
-- =============================================================

-- Validate that users.user_type matches the subclass table being inserted into
CREATE OR REPLACE FUNCTION fn_check_user_subclass_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_type VARCHAR(20);
    v_expected_type VARCHAR(20);
BEGIN
    SELECT user_type INTO v_user_type FROM users WHERE user_id = NEW.user_id;

    IF TG_TABLE_NAME = 'student' THEN
        v_expected_type := 'STUDENT';
    ELSIF TG_TABLE_NAME = 'faculty' THEN
        v_expected_type := 'FACULTY';
    ELSIF TG_TABLE_NAME = 'guest' THEN
        v_expected_type := 'GUEST';
    END IF;

    IF v_user_type <> v_expected_type THEN
        RAISE EXCEPTION 'User type in users table (%) does not match subclass table %.' ,
            v_user_type, v_expected_type
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_subclass_match
BEFORE INSERT OR UPDATE ON student
FOR EACH ROW EXECUTE FUNCTION fn_check_user_subclass_match();

CREATE TRIGGER trg_faculty_subclass_match
BEFORE INSERT OR UPDATE ON faculty
FOR EACH ROW EXECUTE FUNCTION fn_check_user_subclass_match();

CREATE TRIGGER trg_guest_subclass_match
BEFORE INSERT OR UPDATE ON guest
FOR EACH ROW EXECUTE FUNCTION fn_check_user_subclass_match();

-- Prevent altering user_type once a subclass profile exists
CREATE OR REPLACE FUNCTION fn_lock_user_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.user_type <> NEW.user_type THEN
        IF EXISTS (SELECT 1 FROM student WHERE user_id = NEW.user_id)
           OR EXISTS (SELECT 1 FROM faculty WHERE user_id = NEW.user_id)
           OR EXISTS (SELECT 1 FROM guest WHERE user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'user_type is locked once a student, faculty, or guest record exists.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_user_type
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_lock_user_type();

-- =============================================================
-- 6. BR10: CANCELLATION CASCADE
-- =============================================================

-- Cancelling a booking cancels all its tickets and refunds successful payments
CREATE OR REPLACE FUNCTION fn_cascade_booking_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status <> 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
        -- Cancel live tickets
        UPDATE ticket
        SET status = 'CANCELLED'
        WHERE booking_id = NEW.booking_id
          AND status IN ('HELD', 'ACTIVE');

        -- Refund successful payment
        UPDATE payment
        SET status = 'REFUNDED'
        WHERE booking_id = NEW.booking_id
          AND status = 'SUCCESS';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_cancellation
AFTER UPDATE ON booking
FOR EACH ROW EXECUTE FUNCTION fn_cascade_booking_cancellation();

-- Cancelling a show cancels all its active/pending bookings
CREATE OR REPLACE FUNCTION fn_cascade_show_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status <> 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
        UPDATE booking
        SET status = 'CANCELLED'
        WHERE show_id = NEW.show_id
          AND status IN ('PENDING', 'CONFIRMED');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_show_cancellation
AFTER UPDATE ON show
FOR EACH ROW EXECUTE FUNCTION fn_cascade_show_cancellation();

-- =============================================================
-- 7. BR12: SHOW PRICE VENUE CATEGORY VALIDATION
-- =============================================================
CREATE OR REPLACE FUNCTION fn_check_show_price_venue_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_show_venue INT;
    v_category_venue INT;
BEGIN
    SELECT venue_id INTO v_show_venue FROM show WHERE show_id = NEW.show_id;
    SELECT venue_id INTO v_category_venue FROM seat_category WHERE category_id = NEW.category_id;

    IF v_show_venue <> v_category_venue THEN
        RAISE EXCEPTION 'Seat category does not belong to the venue of this show.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_show_price_venue_category
BEFORE INSERT OR UPDATE ON show_price
FOR EACH ROW EXECUTE FUNCTION fn_check_show_price_venue_category();

-- =============================================================
-- 8. BR13: SHOW DURATION VALIDATION
-- =============================================================
CREATE OR REPLACE FUNCTION fn_check_show_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_duration_min INT;
    v_show_minutes NUMERIC;
BEGIN
    SELECT duration_min INTO v_duration_min FROM event WHERE event_id = NEW.event_id;
    v_show_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;

    IF v_show_minutes < v_duration_min THEN
        RAISE EXCEPTION 'Show duration (% min) must be at least as long as event duration (% min).' ,
            v_show_minutes, v_duration_min
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_show_duration
BEFORE INSERT OR UPDATE ON show
FOR EACH ROW EXECUTE FUNCTION fn_check_show_duration();

-- =============================================================
-- 9. TOTAL_AMOUNT AUTOMATIC SYNCHRONIZATION
-- =============================================================
-- Automatically recomputes booking.total_amount whenever tickets
-- are inserted, updated, or deleted.
CREATE OR REPLACE FUNCTION fn_sync_booking_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_booking_id INT;
    v_new_total NUMERIC(10, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_target_booking_id := OLD.booking_id;
    ELSE
        v_target_booking_id := NEW.booking_id;
    END IF;

    -- Sum prices of live (HELD or ACTIVE) tickets
    SELECT COALESCE(SUM(price_paid), 0.00) INTO v_new_total
    FROM ticket
    WHERE booking_id = v_target_booking_id
      AND status IN ('HELD', 'ACTIVE');

    UPDATE booking
    SET total_amount = v_new_total
    WHERE booking_id = v_target_booking_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_booking_total_amount
AFTER INSERT OR UPDATE OR DELETE ON ticket
FOR EACH ROW EXECUTE FUNCTION fn_sync_booking_total_amount();
