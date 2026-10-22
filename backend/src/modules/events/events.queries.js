// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.queries.js
// SQL queries for event catalog, filtering, and detail views
// ─────────────────────────────────────────────────────────────

import { pool } from '../../db/pool.js';

/**
 * Builds and executes dynamic query to list events with filters, search, and pagination.
 * Computes next upcoming show timestamp and total active shows count per event.
 */
export async function getEventsList({ type, club_id, from, to, q, sort, limit = 20, offset = 0 }) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  // Filter: Event Type / Category
  if (type) {
    conditions.push(`e.event_type = $${paramIdx++}`);
    params.push(type.toUpperCase());
  }

  // Filter: Organizing Club
  if (club_id) {
    conditions.push(`e.club_id = $${paramIdx++}`);
    params.push(parseInt(club_id, 10));
  }

  // Filter: Free-text Search on Title or Description
  if (q && q.trim()) {
    conditions.push(`(e.title ILIKE $${paramIdx} OR e.description ILIKE $${paramIdx})`);
    params.push(`%${q.trim()}%`);
    paramIdx++;
  }

  // Date Range Filters on Shows
  if (from) {
    conditions.push(`EXISTS (
      SELECT 1 FROM show s_sub 
      WHERE s_sub.event_id = e.event_id 
        AND s_sub.start_time >= $${paramIdx++}
        AND s_sub.status <> 'CANCELLED'
    )`);
    params.push(new Date(from).toISOString());
  }

  if (to) {
    conditions.push(`EXISTS (
      SELECT 1 FROM show s_sub 
      WHERE s_sub.event_id = e.event_id 
        AND s_sub.start_time <= $${paramIdx++}
        AND s_sub.status <> 'CANCELLED'
    )`);
    params.push(new Date(to).toISOString());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Determine Order By clause
  let orderByClause = 'ORDER BY next_show_at ASC NULLS LAST, e.event_id ASC';
  if (sort === 'date_desc') {
    orderByClause = 'ORDER BY next_show_at DESC NULLS LAST, e.event_id DESC';
  } else if (sort === 'title') {
    orderByClause = 'ORDER BY e.title ASC';
  }

  const query = `
    SELECT 
      e.event_id,
      e.title,
      e.event_type AS type,
      e.event_type,
      e.description,
      e.duration_min,
      c.club_id,
      c.name AS club_name,
      MIN(s.start_time) FILTER (WHERE s.start_time >= CURRENT_TIMESTAMP AND s.status <> 'CANCELLED') AS next_show_at,
      COUNT(DISTINCT s.show_id) FILTER (WHERE s.status <> 'CANCELLED')::int AS shows_count
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN show s ON e.event_id = s.event_id
    ${whereClause}
    GROUP BY e.event_id, c.club_id, c.name
    ${orderByClause}
    LIMIT $${paramIdx++} OFFSET $${paramIdx++};
  `;

  params.push(limit, offset);
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Counts total matching events for pagination calculation
 */
export async function getEventsCount({ type, club_id, from, to, q }) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (type) {
    conditions.push(`e.event_type = $${paramIdx++}`);
    params.push(type.toUpperCase());
  }

  if (club_id) {
    conditions.push(`e.club_id = $${paramIdx++}`);
    params.push(parseInt(club_id, 10));
  }

  if (q && q.trim()) {
    conditions.push(`(e.title ILIKE $${paramIdx} OR e.description ILIKE $${paramIdx})`);
    params.push(`%${q.trim()}%`);
    paramIdx++;
  }

  if (from) {
    conditions.push(`EXISTS (
      SELECT 1 FROM show s_sub 
      WHERE s_sub.event_id = e.event_id 
        AND s_sub.start_time >= $${paramIdx++}
        AND s_sub.status <> 'CANCELLED'
    )`);
    params.push(new Date(from).toISOString());
  }

  if (to) {
    conditions.push(`EXISTS (
      SELECT 1 FROM show s_sub 
      WHERE s_sub.event_id = e.event_id 
        AND s_sub.start_time <= $${paramIdx++}
        AND s_sub.status <> 'CANCELLED'
    )`);
    params.push(new Date(to).toISOString());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT COUNT(DISTINCT e.event_id)::int AS total
    FROM event e
    ${whereClause};
  `;

  const result = await pool.query(query, params);
  return result.rows[0]?.total || 0;
}

/**
 * Retrieves a single event by ID with organizing club information
 */
export async function getEventById(eventId) {
  const query = `
    SELECT 
      e.event_id,
      e.title,
      e.event_type AS type,
      e.event_type,
      e.description,
      e.duration_min,
      e.created_at,
      c.club_id,
      c.name AS club_name,
      c.club_email
    FROM event e
    JOIN club c ON e.club_id = c.club_id
    WHERE e.event_id = $1;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows[0] || null;
}

/**
 * Retrieves all upcoming and scheduled shows for an event with venue info
 */
export async function getShowsByEventId(eventId) {
  const query = `
    SELECT 
      s.show_id,
      s.start_time,
      s.end_time,
      s.status,
      v.venue_id,
      v.name AS venue_name,
      LOWER(v.venue_type) AS venue_type,
      v.capacity
    FROM show s
    JOIN venue v ON s.venue_id = v.venue_id
    WHERE s.event_id = $1
      AND s.status <> 'CANCELLED'
    ORDER BY s.start_time ASC;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows;
}

/**
 * Retrieves available clubs for filter dropdowns
 */
export async function getClubsList() {
  const query = `
    SELECT club_id, name AS club_name
    FROM club
    ORDER BY name ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
}
