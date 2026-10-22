// ─────────────────────────────────────────────────────────────
// backend/src/modules/shows/shows.queries.js
// SQL queries for show details, pricing grid, and seat availability
// ─────────────────────────────────────────────────────────────

import { pool } from '../../db/pool.js';

/**
 * Executes the stored function expire_holds(show_id) to release any
 * expired holds prior to calculating seat availability.
 */
export async function expireHoldsForShow(showId) {
  await pool.query('SELECT expire_holds($1);', [showId]);
}

/**
 * Retrieves basic show metadata with related event, club, and venue information
 */
export async function getShowById(showId) {
  const query = `
    SELECT 
      s.show_id,
      s.start_time,
      s.end_time,
      s.status,
      e.event_id,
      e.title AS event_title,
      e.event_type,
      e.description AS event_description,
      e.duration_min,
      c.club_id,
      c.name AS club_name,
      v.venue_id,
      v.name AS venue_name,
      LOWER(v.venue_type) AS venue_type,
      v.capacity
    FROM show s
    JOIN event e ON s.event_id = e.event_id
    JOIN club c ON e.club_id = c.club_id
    JOIN venue v ON s.venue_id = v.venue_id
    WHERE s.show_id = $1;
  `;
  const result = await pool.query(query, [showId]);
  return result.rows[0] || null;
}

/**
 * Retrieves the pricing matrix for a show across all seat categories and attendee types
 */
export async function getShowPrices(showId) {
  const query = `
    SELECT 
      sp.category_id,
      sc.name AS category_name,
      sp.user_type,
      sp.price::numeric AS price
    FROM show_price sp
    JOIN seat_category sc ON sp.category_id = sc.category_id
    WHERE sp.show_id = $1
    ORDER BY sp.category_id, sp.user_type;
  `;
  const result = await pool.query(query, [showId]);
  return result.rows;
}

/**
 * Retrieves all seats in an auditorium along with their real-time status ('free', 'held', 'sold')
 * for the specified show based on live tickets.
 */
export async function getAuditoriumSeats(showId, venueId) {
  const query = `
    SELECT 
      s.venue_id,
      s.row_label,
      s.seat_no,
      s.seat_no AS seat_number,
      s.category_id,
      sc.name AS category_name,
      COALESCE(
        CASE 
          WHEN t.status = 'HELD' THEN 'held'
          WHEN t.status = 'ACTIVE' THEN 'sold'
          ELSE NULL
        END,
        'free'
      ) AS status
    FROM seat s
    JOIN seat_category sc ON s.category_id = sc.category_id
    LEFT JOIN ticket t ON (
      t.show_id = $1 
      AND t.venue_id = s.venue_id 
      AND t.row_label = s.row_label 
      AND t.seat_no = s.seat_no 
      AND t.status IN ('HELD', 'ACTIVE')
    )
    WHERE s.venue_id = $2
    ORDER BY s.row_label ASC, s.seat_no ASC;
  `;
  const result = await pool.query(query, [showId, venueId]);
  return result.rows;
}

/**
 * Retrieves classroom general admission capacity, active/held ticket counts,
 * and remaining available slots for a show.
 */
export async function getClassroomSeatStatus(showId, venueId) {
  const query = `
    SELECT 
      v.venue_id,
      v.name AS venue_name,
      LOWER(v.venue_type) AS venue_type,
      v.capacity,
      sc.category_id,
      sc.name AS category_name,
      COUNT(t.ticket_id)::int AS booked_count,
      GREATEST(0, (v.capacity - COUNT(t.ticket_id)::int)) AS remaining
    FROM show s
    JOIN venue v ON s.venue_id = v.venue_id
    LEFT JOIN seat_category sc ON sc.venue_id = v.venue_id
    LEFT JOIN ticket t ON t.show_id = s.show_id AND t.status IN ('HELD', 'ACTIVE')
    WHERE s.show_id = $1
    GROUP BY v.venue_id, v.name, v.venue_type, v.capacity, sc.category_id, sc.name;
  `;
  const result = await pool.query(query, [showId]);
  return result.rows[0] || null;
}
