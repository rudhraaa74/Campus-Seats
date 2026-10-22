// ─────────────────────────────────────────────────────────────
// backend/src/modules/organizer/organizer.queries.js
// SQL queries for organizer event creation, show scheduling & price grid
// ─────────────────────────────────────────────────────────────

import { pool } from '../../db/pool.js';

/**
 * Retrieves all venues with their configured seat categories
 */
export async function getVenuesWithCategories() {
  const query = `
    SELECT 
      v.venue_id,
      v.name,
      LOWER(v.venue_type) AS venue_type,
      v.capacity,
      COALESCE(
        json_agg(
          json_build_object(
            'category_id', sc.category_id,
            'name', sc.name
          ) ORDER BY sc.category_id
        ) FILTER (WHERE sc.category_id IS NOT NULL),
        '[]'
      ) AS categories
    FROM venue v
    LEFT JOIN seat_category sc ON v.venue_id = sc.venue_id
    GROUP BY v.venue_id, v.name, v.venue_type, v.capacity
    ORDER BY v.venue_id;
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Retrieves events managed by the given club IDs
 */
export async function getEventsByClubs(clubIds) {
  if (!clubIds || clubIds.length === 0) return [];

  const query = `
    SELECT 
      e.event_id,
      e.club_id,
      c.name AS club_name,
      e.title,
      e.event_type,
      e.duration_min,
      e.description,
      COUNT(s.show_id)::int AS show_count
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN show s ON e.event_id = s.event_id
    WHERE e.club_id = ANY($1::int[])
    GROUP BY e.event_id, e.club_id, c.name, e.title, e.event_type, e.duration_min, e.description
    ORDER BY e.event_id DESC;
  `;
  const result = await pool.query(query, [clubIds]);
  return result.rows;
}

/**
 * Retrieves a single event with its club info
 */
export async function getEventById(eventId) {
  const query = `
    SELECT 
      e.event_id,
      e.club_id,
      c.name AS club_name,
      e.title,
      e.event_type,
      e.duration_min,
      e.description
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    WHERE e.event_id = $1;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows[0] || null;
}

/**
 * Inserts a new event
 */
export async function createEvent({ clubId, title, eventType, durationMin, description }) {
  const query = `
    INSERT INTO event (club_id, title, event_type, duration_min, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING event_id, club_id, title, event_type, duration_min, description;
  `;
  const result = await pool.query(query, [
    clubId,
    title.trim(),
    (eventType || 'CULTURAL').toUpperCase(),
    durationMin,
    description ? description.trim() : null,
  ]);
  return result.rows[0];
}

/**
 * Updates an existing event
 */
export async function updateEvent(eventId, { title, eventType, durationMin, description }) {
  const query = `
    UPDATE event
    SET 
      title = COALESCE($2, title),
      event_type = COALESCE($3, event_type),
      duration_min = COALESCE($4, duration_min),
      description = COALESCE($5, description)
    WHERE event_id = $1
    RETURNING event_id, club_id, title, event_type, duration_min, description;
  `;
  const result = await pool.query(query, [
    eventId,
    title ? title.trim() : null,
    eventType ? eventType.toUpperCase() : null,
    durationMin ? parseInt(durationMin, 10) : null,
    description !== undefined ? (description ? description.trim() : null) : null,
  ]);
  return result.rows[0] || null;
}

/**
 * Inserts a new show (enforcing BR2 overlap and BR13 duration triggers)
 */
export async function createShow({ eventId, venueId, startTime, endTime }) {
  const query = `
    INSERT INTO show (event_id, venue_id, start_time, end_time, status)
    VALUES ($1, $2, $3, $4, 'SCHEDULED')
    RETURNING show_id, event_id, venue_id, start_time, end_time, status;
  `;
  const result = await pool.query(query, [eventId, venueId, startTime, endTime]);
  return result.rows[0];
}

/**
 * Retrieves show details along with event and venue information
 */
export async function getShowById(showId) {
  const query = `
    SELECT 
      s.show_id,
      s.event_id,
      s.venue_id,
      s.start_time,
      s.end_time,
      s.status,
      e.club_id,
      e.title AS event_title,
      e.duration_min,
      c.name AS club_name,
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
 * Cancels a show (triggers BR10 cascade on bookings and refunds)
 */
export async function cancelShow(showId) {
  const query = `
    UPDATE show
    SET status = 'CANCELLED'
    WHERE show_id = $1
    RETURNING show_id, event_id, venue_id, start_time, end_time, status;
  `;
  const result = await pool.query(query, [showId]);
  return result.rows[0] || null;
}

/**
 * Inserts or updates price for a show, category, and attendee type
 * Trigger trg_show_price_venue_category (BR12) validates category belongs to venue
 */
export async function upsertShowPrice(client, { showId, categoryId, userType, price }) {
  const query = `
    INSERT INTO show_price (show_id, category_id, user_type, price)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (show_id, category_id, user_type)
    DO UPDATE SET price = EXCLUDED.price
    RETURNING show_id, category_id, user_type, price;
  `;
  const result = await client.query(query, [showId, categoryId, userType, price]);
  return result.rows[0];
}

/**
 * Retrieves configured prices for a show
 */
export async function getShowPrices(showId) {
  const query = `
    SELECT 
      sp.show_id,
      sp.category_id,
      sp.user_type,
      sp.price,
      sc.name AS category_name
    FROM show_price sp
    JOIN seat_category sc ON sp.category_id = sc.category_id
    WHERE sp.show_id = $1
    ORDER BY sp.category_id, sp.user_type;
  `;
  const result = await pool.query(query, [showId]);
  return result.rows;
}
