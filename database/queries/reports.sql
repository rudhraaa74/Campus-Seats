-- ─────────────────────────────────────────────────────────────
-- database/queries/reports.sql
-- SeatSync — Non-Trivial Analytical & Reporting Queries
-- ─────────────────────────────────────────────────────────────
-- Demonstrates multi-table joins, subqueries, CTEs, window
-- functions, and aggregate filtering required for viva / evaluation.
-- ─────────────────────────────────────────────────────────────

-- 1. SHOW OCCUPANCY & CAPACITY ANALYSIS (Multi-Table Joins, GROUP BY, View v_venue_capacity)
-- Compares confirmed ticket sales against effective venue capacity.
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

-- 2. REVENUE BREAKDOWN BY ATTENDEE TYPE (Single-Pass Pivot with FILTER)
-- Categorizes ticket counts and revenue contributions across Student, Faculty, and Guest tiers.
SELECT
    e.event_id,
    e.title AS event_title,
    COUNT(*) FILTER (WHERE t.attendee_type = 'STUDENT') AS student_tickets,
    COALESCE(SUM(t.price_paid) FILTER (WHERE t.attendee_type = 'STUDENT'), 0.00) AS student_revenue,
    COUNT(*) FILTER (WHERE t.attendee_type = 'FACULTY') AS faculty_tickets,
    COALESCE(SUM(t.price_paid) FILTER (WHERE t.attendee_type = 'FACULTY'), 0.00) AS faculty_revenue,
    COUNT(*) FILTER (WHERE t.attendee_type = 'GUEST') AS guest_tickets,
    COALESCE(SUM(t.price_paid) FILTER (WHERE t.attendee_type = 'GUEST'), 0.00) AS guest_revenue,
    COUNT(t.ticket_id) AS total_tickets_sold,
    COALESCE(SUM(t.price_paid), 0.00) AS total_revenue
FROM event e
JOIN show s ON e.event_id = s.event_id
JOIN ticket t ON s.show_id = t.show_id
WHERE t.status = 'ACTIVE'
GROUP BY e.event_id, e.title
ORDER BY total_revenue DESC;

-- 3. TOP RANKED EVENTS BY REVENUE (CTE + Window Function: DENSE_RANK)
-- Uses a Common Table Expression (CTE) and DENSE_RANK() to rank events without gaps.
WITH event_revenue AS (
    SELECT
        e.event_id,
        e.title AS event_title,
        e.club_id,
        c.name AS hosting_club,
        COUNT(DISTINCT s.show_id) AS total_shows_held,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE') AS total_tickets_sold,
        COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00) AS total_revenue
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN show s ON e.event_id = s.event_id
    LEFT JOIN ticket t ON s.show_id = t.show_id
    GROUP BY e.event_id, e.title, e.club_id, c.name
)
SELECT
    DENSE_RANK() OVER (ORDER BY total_revenue DESC) AS revenue_rank,
    event_id,
    event_title,
    hosting_club,
    total_shows_held,
    total_tickets_sold,
    total_revenue
FROM event_revenue
ORDER BY revenue_rank ASC, total_revenue DESC;

-- 4. UPCOMING SHOWS WITH NO BOOKINGS (Correlated Subquery: NOT EXISTS)
-- Identifies upcoming scheduled shows that currently have zero live (active or held) tickets.
SELECT
    s.show_id,
    c.club_id,
    c.name AS club_name,
    e.event_id,
    e.title AS event_title,
    v.venue_id,
    v.name AS venue_name,
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

-- 5. MOST ACTIVE ATTENDEES (GROUP BY + HAVING >= 3)
-- Identifies repeat campus attendees who have placed 3 or more bookings.
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
HAVING COUNT(b.booking_id) >= 3
ORDER BY total_spent DESC, confirmed_bookings DESC;

-- 6. AUDITORIUM SEAT POPULARITY BY ROW (Aggregation & Filtering)
-- Identifies which physical seat rows sell the most tickets across venues.
SELECT
    v.name AS venue_name,
    t.row_label,
    COUNT(*) AS tickets_sold
FROM ticket t
JOIN venue v ON t.venue_id = v.venue_id
WHERE t.status = 'ACTIVE'
  AND t.row_label IS NOT NULL
GROUP BY v.name, t.row_label
ORDER BY tickets_sold DESC;

-- 7. BOOKING CONVERSION & TIMEOUT RATE ANALYSIS (Status Distribution)
-- Tracks checkout efficiency: evaluates proportion of bookings confirmed vs timed out.
SELECT
    COUNT(*) AS total_booking_attempts,
    COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed_bookings,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_bookings,
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
