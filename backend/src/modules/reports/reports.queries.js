// ─────────────────────────────────────────────────────────────
// backend/src/modules/reports/reports.queries.js
// SQL query definitions for analytics, reporting, and KPI retrieval
// ─────────────────────────────────────────────────────────────

export const reportsQueries = {
  // 1. KPI Summary for Manager's Club(s)
  getSummaryKpis: `
    WITH show_metrics AS (
      SELECT
        s.show_id,
        e.event_id,
        c.club_id,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS confirmed_tickets,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'HELD')::INT AS held_tickets,
        COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00) AS show_revenue,
        CASE 
          WHEN vc.total_capacity > 0 THEN 
            (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC / vc.total_capacity) * 100
          ELSE 0.00
        END AS show_occupancy_pct
      FROM club c
      JOIN event e ON c.club_id = e.club_id
      JOIN show s ON e.event_id = s.event_id
      JOIN venue v ON s.venue_id = v.venue_id
      JOIN v_venue_capacity vc ON v.venue_id = vc.venue_id
      LEFT JOIN ticket t ON s.show_id = t.show_id
      WHERE c.club_id = ANY($1::int[])
        AND s.status <> 'CANCELLED'
      GROUP BY s.show_id, e.event_id, c.club_id, vc.total_capacity
    )
    SELECT
      COUNT(DISTINCT show_id)::INT AS total_shows,
      COUNT(DISTINCT event_id)::INT AS total_events,
      COALESCE(SUM(confirmed_tickets), 0)::INT AS confirmed_tickets,
      COALESCE(SUM(held_tickets), 0)::INT AS held_tickets,
      COALESCE(SUM(show_revenue), 0.00)::NUMERIC AS total_revenue,
      ROUND(COALESCE(AVG(show_occupancy_pct), 0.00), 2)::NUMERIC AS avg_occupancy_pct
    FROM show_metrics;
  `,

  // 2. Show Occupancy Analysis (Query 1: Joins, GROUP BY, view v_venue_capacity)
  getShowOccupancy: `
    SELECT
      s.show_id,
      e.event_id,
      e.title AS event_title,
      c.club_id,
      c.name AS club_name,
      v.venue_id,
      v.name AS venue_name,
      v.venue_type,
      vc.total_capacity,
      s.start_time,
      s.end_time,
      s.status AS show_status,
      COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS confirmed_tickets,
      COUNT(t.ticket_id) FILTER (WHERE t.status = 'HELD')::INT AS held_tickets,
      ROUND(
        (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC / NULLIF(vc.total_capacity, 0)) * 100,
        2
      )::NUMERIC AS occupancy_pct
    FROM show s
    JOIN event e ON s.event_id = e.event_id
    JOIN club c ON e.club_id = c.club_id
    JOIN venue v ON s.venue_id = v.venue_id
    JOIN v_venue_capacity vc ON v.venue_id = vc.venue_id
    LEFT JOIN ticket t ON s.show_id = t.show_id
    WHERE c.club_id = ANY($1::int[])
      AND ($2::int IS NULL OR e.event_id = $2::int)
      AND ($3::timestamptz IS NULL OR s.start_time >= $3::timestamptz)
      AND ($4::timestamptz IS NULL OR s.start_time <= $4::timestamptz)
      AND s.status <> 'CANCELLED'
    GROUP BY s.show_id, e.event_id, e.title, c.club_id, c.name, v.venue_id, v.name, v.venue_type, vc.total_capacity, s.start_time, s.end_time, s.status
    ORDER BY s.start_time ASC;
  `,

  // 3. Revenue Breakdown by Event and Attendee Type (Query 2: CTE + Aggregation)
  getRevenueBreakdown: `
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
      WHERE c.club_id = ANY($1::int[])
        AND ($2::int IS NULL OR e.event_id = $2::int)
        AND t.status = 'ACTIVE'
      GROUP BY c.club_id, c.name, e.event_id, e.title, t.attendee_type
    )
    SELECT
      club_id,
      club_name,
      event_id,
      event_title,
      COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'STUDENT'), 0)::INT AS student_tickets,
      COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'STUDENT'), 0.00)::NUMERIC AS student_revenue,
      COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'FACULTY'), 0)::INT AS faculty_tickets,
      COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'FACULTY'), 0.00)::NUMERIC AS faculty_revenue,
      COALESCE(SUM(ticket_count) FILTER (WHERE attendee_type = 'GUEST'), 0)::INT AS guest_tickets,
      COALESCE(SUM(type_revenue) FILTER (WHERE attendee_type = 'GUEST'), 0.00)::NUMERIC AS guest_revenue,
      COALESCE(SUM(ticket_count), 0)::INT AS total_tickets_sold,
      COALESCE(SUM(type_revenue), 0.00)::NUMERIC AS total_revenue
    FROM ticket_breakdown
    GROUP BY club_id, club_name, event_id, event_title
    ORDER BY total_revenue DESC;
  `,

  // 4. Top Events Ranked by Revenue (Query 3: CTE + DENSE_RANK Window Function)
  getTopEvents: `
    WITH event_revenue AS (
      SELECT
        e.event_id,
        e.title AS event_title,
        e.club_id,
        c.name AS hosting_club,
        e.event_type,
        COUNT(DISTINCT s.show_id)::INT AS total_shows_held,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS total_tickets_sold,
        COALESCE(SUM(t.price_paid) FILTER (WHERE t.status = 'ACTIVE'), 0.00)::NUMERIC AS total_revenue
      FROM event e
      JOIN club c ON e.club_id = c.club_id
      LEFT JOIN show s ON e.event_id = s.event_id
      LEFT JOIN ticket t ON s.show_id = t.show_id
      WHERE c.club_id = ANY($1::int[])
      GROUP BY e.event_id, e.title, e.club_id, c.name, e.event_type
    )
    SELECT
      DENSE_RANK() OVER (ORDER BY total_revenue DESC)::INT AS revenue_rank,
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
  `,

  // 5. Shows with Seats Still Free / No Live Tickets (Query 4: Correlated Subquery with NOT EXISTS)
  getUnsoldShows: `
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
    WHERE c.club_id = ANY($1::int[])
      AND s.status = 'SCHEDULED'
      AND NOT EXISTS (
        SELECT 1
        FROM ticket t
        WHERE t.show_id = s.show_id
          AND t.status IN ('ACTIVE', 'HELD')
      )
    ORDER BY s.start_time ASC;
  `,

  // 6. Most Active Attendees (Query 5: GROUP BY + HAVING)
  getActiveAttendees: `
    SELECT
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.user_type,
      COUNT(b.booking_id)::INT AS total_bookings,
      COUNT(b.booking_id) FILTER (WHERE b.status = 'CONFIRMED')::INT AS confirmed_bookings,
      COUNT(b.booking_id) FILTER (WHERE b.status = 'CANCELLED')::INT AS cancelled_bookings,
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'CONFIRMED'), 0.00)::NUMERIC AS total_spent
    FROM users u
    JOIN booking b ON u.user_id = b.user_id
    JOIN show s ON b.show_id = s.show_id
    JOIN event e ON s.event_id = e.event_id
    WHERE e.club_id = ANY($1::int[])
    GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.user_type
    HAVING COUNT(b.booking_id) >= COALESCE($2::int, 1)
    ORDER BY total_spent DESC, confirmed_bookings DESC;
  `,

  // 7. Auditorium Seat Popularity & Row Utilization
  getRowUtilization: `
    SELECT
      v.name AS venue_name,
      sc.name AS category_name,
      s.row_label,
      COUNT(DISTINCT s.seat_no)::INT AS total_seats_in_row,
      COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::INT AS tickets_sold,
      ROUND(
        (COUNT(t.ticket_id) FILTER (WHERE t.status = 'ACTIVE')::NUMERIC /
         NULLIF(COUNT(DISTINCT s.seat_no) * COUNT(DISTINCT sh.show_id), 0)) * 100,
        2
      )::NUMERIC AS row_fill_rate_pct
    FROM venue v
    JOIN seat_category sc ON v.venue_id = sc.venue_id
    JOIN seat s ON sc.category_id = s.category_id AND sc.venue_id = s.venue_id
    LEFT JOIN show sh ON v.venue_id = sh.venue_id AND sh.status <> 'CANCELLED'
    LEFT JOIN ticket t ON sh.show_id = t.show_id AND s.row_label = t.row_label AND s.seat_no = t.seat_no
    LEFT JOIN event e ON sh.event_id = e.event_id
    WHERE v.venue_type = 'AUDITORIUM'
      AND (e.club_id IS NULL OR e.club_id = ANY($1::int[]))
    GROUP BY v.name, sc.name, s.row_label
    ORDER BY v.name, sc.name, s.row_label;
  `,
};
