-- ─────────────────────────────────────────────────────────────
-- 06_views.sql
-- SeatSync — Database Views for Capacity and Analytics
-- ─────────────────────────────────────────────────────────────

-- 1. V_VENUE_CAPACITY
-- Resolves the effective capacity for every venue on campus.
-- For CLASSROOM: uses the statically declared capacity.
-- For AUDITORIUM: dynamically computes the count of physical seats.
CREATE OR REPLACE VIEW v_venue_capacity AS
SELECT
    v.venue_id,
    v.name AS venue_name,
    v.venue_type,
    CASE
        WHEN v.venue_type = 'CLASSROOM' THEN v.capacity
        ELSE COUNT(s.seat_no)::INT
    END AS total_capacity
FROM venue v
LEFT JOIN seat s ON v.venue_id = s.venue_id
GROUP BY v.venue_id, v.name, v.venue_type, v.capacity;

-- 2. V_SHOW_OCCUPANCY
-- Shows occupancy metrics per performance:
-- total capacity, held tickets, active tickets, and occupancy percentage.
CREATE OR REPLACE VIEW v_show_occupancy AS
SELECT
    s.show_id,
    e.event_id,
    e.title AS event_title,
    v.venue_id,
    v.name AS venue_name,
    v.venue_type,
    vc.total_capacity,
    s.start_time,
    s.end_time,
    s.status AS show_status,
    COUNT(t.ticket_id) FILTER (WHERE t.status IN ('HELD', 'ACTIVE'))::INT AS live_tickets,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS confirmed_tickets,
    ROUND(
        CASE
            WHEN vc.total_capacity > 0 THEN
                (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC / vc.total_capacity) * 100
            ELSE 0.00
        END,
        2
    ) AS occupancy_percentage
FROM show s
JOIN event e ON s.event_id = e.event_id
JOIN venue v ON s.venue_id = v.venue_id
JOIN v_venue_capacity vc ON v.venue_id = vc.venue_id
LEFT JOIN ticket t ON s.show_id = t.show_id
GROUP BY s.show_id, e.event_id, e.title, v.venue_id, v.name, v.venue_type, vc.total_capacity, s.start_time, s.end_time, s.status;

-- 3. V_CLUB_REVENUE
-- Aggregate revenue and ticket metrics for each campus club.
CREATE OR REPLACE VIEW v_club_revenue AS
SELECT
    c.club_id,
    c.name AS club_name,
    COUNT(DISTINCT s.show_id)::INT AS total_shows,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS total_tickets_sold,
    COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00) AS total_revenue
FROM club c
LEFT JOIN event e ON c.club_id = e.club_id
LEFT JOIN show s ON e.event_id = s.event_id
LEFT JOIN ticket t ON s.show_id = t.show_id
GROUP BY c.club_id, c.name;

-- 4. V_TOP_EVENTS
-- Ranks events by total revenue and attendee count.
CREATE OR REPLACE VIEW v_top_events AS
SELECT
    e.event_id,
    e.title AS event_title,
    e.event_type,
    c.club_id,
    c.name AS club_name,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS tickets_sold,
    COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00) AS total_revenue
FROM event e
JOIN club c ON e.club_id = c.club_id
LEFT JOIN show s ON e.event_id = s.event_id
LEFT JOIN ticket t ON s.show_id = t.show_id
GROUP BY e.event_id, e.title, e.event_type, c.club_id, c.name
ORDER BY total_revenue DESC, tickets_sold DESC;
