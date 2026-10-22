-- ─────────────────────────────────────────────────────────────
-- seed/02_demo.sql
-- SeatSync — Demo Development Dataset
-- ─────────────────────────────────────────────────────────────
-- Populates events, upcoming shows, price matrices, sample
-- confirmed and held bookings, tickets, and payments for testing.
-- ─────────────────────────────────────────────────────────────

-- 1. EVENTS
INSERT INTO event (event_id, club_id, title, event_type, duration_min, description)
VALUES
    (1, 1, 'Campus Rock Night 2026', 'CULTURAL', 180, 'Annual rock concert featuring campus bands and guest performers.'),
    (2, 2, 'The Tempest: Annual Production', 'CULTURAL', 120, 'A modern dramatic adaptation of Shakespeare''s The Tempest.'),
    (3, 1, 'Acoustic Unplugged', 'CULTURAL', 90, 'An intimate evening of acoustic music in a classroom setting.')
ON CONFLICT (event_id) DO NOTHING;

ALTER SEQUENCE event_event_id_seq RESTART WITH 4;

-- 2. SHOWS
-- All shows scheduled in the future with durations matching or exceeding event durations
INSERT INTO show (show_id, event_id, venue_id, start_time, end_time, status)
VALUES
    -- Show 1: Rock Night in Main Auditorium
    (1, 1, 1, '2026-11-10 18:00:00+00', '2026-11-10 21:00:00+00', 'SCHEDULED'),
    -- Show 2: The Tempest in Main Auditorium (non-overlapping next evening)
    (2, 2, 1, '2026-11-11 18:00:00+00', '2026-11-11 20:30:00+00', 'SCHEDULED'),
    -- Show 3: Acoustic Unplugged in Lecture Hall 101 (Classroom)
    (3, 3, 2, '2026-11-12 17:00:00+00', '2026-11-12 19:00:00+00', 'SCHEDULED')
ON CONFLICT (show_id) DO NOTHING;

ALTER SEQUENCE show_show_id_seq RESTART WITH 4;

-- 3. SHOW PRICES
-- Show 1 (Main Auditorium: Gold = cat 1, Silver = cat 2)
INSERT INTO show_price (show_id, category_id, user_type, price)
VALUES
    (1, 1, 'STUDENT', 100.00),
    (1, 1, 'FACULTY', 150.00),
    (1, 1, 'GUEST', 250.00),
    (1, 2, 'STUDENT', 60.00),
    (1, 2, 'FACULTY', 100.00),
    (1, 2, 'GUEST', 150.00),

    -- Show 2 (Main Auditorium)
    (2, 1, 'STUDENT', 80.00),
    (2, 1, 'FACULTY', 120.00),
    (2, 1, 'GUEST', 200.00),
    (2, 2, 'STUDENT', 50.00),
    (2, 2, 'FACULTY', 80.00),
    (2, 2, 'GUEST', 120.00),

    -- Show 3 (Classroom 101: General = cat 3)
    (3, 3, 'STUDENT', 20.00),
    (3, 3, 'FACULTY', 50.00),
    (3, 3, 'GUEST', 80.00)
ON CONFLICT (show_id, category_id, user_type) DO NOTHING;

-- 4. BOOKINGS
-- Booking 1: Confirmed booking by Rudhra (user 2) for Show 1 (Gold seats O-1, O-2: 100 + 250 = 350)
INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
VALUES
    (1, 2, 1, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '55 minutes', 'CONFIRMED', 350.00),
    -- Booking 2: Active pending hold by Areesha (user 3) for Show 1 (Silver seat B-5: 60)
    (2, 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING', 60.00),
    -- Booking 3: Confirmed classroom booking by Faculty Ramesh (user 4) for Show 3
    (3, 4, 3, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes', 'CONFIRMED', 50.00)
ON CONFLICT (booking_id) DO NOTHING;

ALTER SEQUENCE booking_booking_id_seq RESTART WITH 4;

-- 5. TICKETS
INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
VALUES
    -- Tickets for Booking 1 (Auditorium: Gold seats O-1 and O-2)
    (1, 1, 1, 1, 'O', 1, 'STUDENT', 100.00, 'ACTIVE'),
    (2, 1, 1, 1, 'O', 2, 'GUEST', 250.00, 'ACTIVE'),
    -- Ticket for Booking 2 (Auditorium: Silver seat B-5 on hold)
    (3, 2, 1, 1, 'B', 5, 'STUDENT', 60.00, 'HELD'),
    -- Ticket for Booking 3 (Classroom: general admission, no seat numbers)
    (4, 3, 3, 2, NULL, NULL, 'FACULTY', 50.00, 'ACTIVE')
ON CONFLICT (ticket_id) DO NOTHING;


ALTER SEQUENCE ticket_ticket_id_seq RESTART WITH 5;

-- 6. PAYMENTS
INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
VALUES
    (1, 1, 350.00, 'UPI', 'SUCCESS', 'DEMO_PAY_001', CURRENT_TIMESTAMP - INTERVAL '58 minutes'),
    (2, 3, 50.00, 'CREDIT_CARD', 'SUCCESS', 'DEMO_PAY_002', CURRENT_TIMESTAMP - INTERVAL '28 minutes')
ON CONFLICT (payment_id) DO NOTHING;

ALTER SEQUENCE payment_payment_id_seq RESTART WITH 3;
