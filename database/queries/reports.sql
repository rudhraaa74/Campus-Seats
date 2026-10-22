-- ─────────────────────────────────────────────────────────────
-- database/queries/reports.sql
-- SeatSync — Non-Trivial Analytical & Reporting Queries
-- ─────────────────────────────────────────────────────────────
-- Demonstrates multi-table joins, subqueries, CTEs, window
-- functions, and aggregate filtering required for viva / evaluation.
-- ─────────────────────────────────────────────────────────────

-- 1. SHOW OCCUPANCY & CAPACITY ANALYSIS (Joins, GROUP BY, View v_venue_capacity)
-- Calculates detailed occupancy metrics per show, comparing
-- live demand (held + confirmed) against venue capacity.
SELECT
    s.show_id,
    c.club_id,
    c.name AS club_name,
    e.event_id,
    e.title AS event_title,
    v.venue_id,
    v.name AS venue_name,
    v.venue_type,
    vc.total_capacity,
    s.start_time,
    s.end_time,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE') AS confirmed_tickets,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'HELD') AS held_tickets,
    ROUND(
        (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC / NULLIF(vc.total_capacity, 0)) * 100,
        2
    ) AS occupancy_pct
FROM show s
JOIN event e ON s.event_id = e.event_id
JOIN club c ON e.club_id = c.club_id
JOIN venue v ON s.venue_id = v.venue_id
JOIN v_venue_capacity vc ON v.venue_id = vc.venue_id
LEFT JOIN ticket t ON s.show_id = t.show_id
WHERE s.status <> 'CANCELLED'
GROUP BY s.show_id, c.club_id, c.name, e.event_id, e.title, v.venue_id, v.name, v.venue_type, vc.total_capacity, s.start_time, s.end_time
ORDER BY s.start_time ASC;

-- 2. REVENUE BREAKDOWN BY ATTENDEE TYPE (CTE + Aggregation)
-- Uses a Common Table Expression (CTE) to categorize ticket sales
-- and revenue contribution by attendee category (Student vs Faculty vs Guest).
WITH ticket_breakdown AS (
    SELECT
        c.club_id,
        c.name AS club_name,
        e.event_id,
        e.title AS event_title,
        t.attendee_type,
        COUNT(t.ticket_id) AS ticket_count,
        SUM(t.price_paid) AS type_revenue
    FROM club c
    JOIN event e ON c.club_id = e.club_id
    JOIN show s ON e.event_id = s.event_id
    JOIN ticket t ON s.show_id = t.show_id
    WHERE t.status = 'ACTIVE'
    GROUP BY c.club_id, c.name, e.event_id, e.title, t.attendee_type
)
SELECT
    club_id,
    club_name,
    event_id,
    event_title,
    COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'STUDENT'), 0) AS student_tickets,
    COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'STUDENT'), 0.00) AS student_revenue,
    COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'FACULTY'), 0) AS faculty_tickets,
    COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'FACULTY'), 0.00) AS faculty_revenue,
    COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'GUEST'), 0) AS guest_tickets,
    COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'GUEST'), 0.00) AS guest_revenue,
    SUM(type_revenue) AS total_event_revenue
FROM ticket_breakdown
GROUP BY club_id, club_name, event_id, event_title
ORDER BY total_event_revenue DESC;

-- 3. TOP RANKED EVENTS BY REVENUE (CTE + Window Function: DENSE_RANK)
-- Employs CTE and DENSE_RANK() OVER (ORDER BY revenue DESC) to rank events.
WITH event_revenue AS (
    SELECT
        e.event_id,
        e.title AS event_title,
        e.club_id,
        c.name AS hosting_club,
        e.event_type,
        COUNT(DISTINCT s.show_id) AS total_shows_held,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE') AS total_tickets_sold,
        COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00) AS total_revenue
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN show s ON e.event_id = s.event_id
    LEFT JOIN ticket t ON s.show_id = t.show_id
    GROUP BY e.event_id, e.title, e.club_id, c.name, e.event_type
)
SELECT
    DENSE_RANK() OVER (ORDER BY total_revenue DESC) AS revenue_rank,
    event_id,
    event_title,
    club_id,
    hosting_club,
    event_type,
    total_shows_held,
    total_tickets_sold,
    total_revenue
FROM event_revenue
ORDER BY revenue_rank ASC, total_revenue DESC;

-- 4. SHOWS WITH SEATS STILL FREE / NO LIVE TICKETS (Correlated Subquery: NOT EXISTS)
-- Identifies scheduled upcoming shows that currently have no active or held tickets.
SELECT
    s.show_id,
    c.club_id,
    c.name AS club_name,
    e.event_id,
    e.title AS event_title,
    v.venue_id,
    v.name AS venue_name,
    v.venue_type,
    s.start_time,
    s.end_time
FROM show s
JOIN event e ON s.event_id = e.event_id
JOIN club c ON e.club_id = c.club_id
JOIN venue v ON s.venue_id = v.venue_id
WHERE s.status = 'SCHEDULED'
  AND NOT EXISTS (
      SELECT 1
      FROM ticket t
      WHERE t.show_id = s.show_id
        AND t.status IN ('ACTIVE', 'HELD')
  )
ORDER BY s.start_time ASC;

-- 5. MOST ACTIVE ATTENDEES (GROUP BY + HAVING)
-- Filters attendees who have made more than N bookings to identify top campus participants.
SELECT
    u.user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.user_type,
    COUNT(b.booking_id) AS total_bookings,
    COUNT(b.booking_id) FILTER (WHERE b.status = 'CONFIRMED') AS confirmed_bookings,
    COUNT(b.booking_id) FILTER (WHERE b.status = 'CANCELLED') AS cancelled_bookings,
    COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'CONFIRMED'), 0.00) AS total_spent
FROM users u
JOIN booking b ON u.user_id = b.user_id
GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.user_type
HAVING COUNT(b.booking_id) >= 1
ORDER BY total_spent DESC, confirmed_bookings DESC;

-- 6. AUDITORIUM SEAT POPULARITY & ROW UTILIZATION
-- Analyzes which seat rows and categories achieve highest demand.
SELECT
    v.name AS venue_name,
    sc.name AS category_name,
    s.row_label,
    COUNT(DISTINCT s.seat_no) AS total_seats_in_row,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE') AS tickets_sold,
    ROUND(
        (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC /
         NULLIF(COUNT(DISTINCT s.seat_no) * COUNT(DISTINCT sh.show_id), 0)) * 100,
        2
    ) AS row_fill_rate_pct
FROM venue v
JOIN seat_category sc ON v.venue_id = sc.venue_id
JOIN seat s ON sc.category_id = s.category_id AND sc.venue_id = s.venue_id
LEFT JOIN show sh ON v.venue_id = sh.venue_id AND sh.status <> 'CANCELLED'
LEFT JOIN ticket t ON sh.show_id = t.show_id AND s.row_label = t.row_label AND s.seat_no = t.seat_no
WHERE v.venue_type = 'AUDITORIUM'
GROUP BY v.name, sc.name, s.row_label
ORDER BY v.name, sc.name, s.row_label;

-- 7. BOOKING CONVERSION & EXPIRY ANALYSIS (Aggregates & Status Distribution)
-- Evaluates checkout efficiency: tracks the proportion of PENDING bookings
-- that completed payment versus those that timed out and EXPIRED.
SELECT
    COUNT(*) AS total_booking_attempts,
    COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed_bookings,
    COUNT(*) FILTER (WHERE status = 'EXPIRED') AS expired_bookings,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_bookings,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'CONFIRMED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
        2
    ) AS conversion_rate_pct,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'EXPIRED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
        2
    ) AS timeout_rate_pct
FROM booking;
