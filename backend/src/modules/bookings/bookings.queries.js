// ─────────────────────────────────────────────────────────────
// backend/src/modules/bookings/bookings.queries.js
// SQL queries for hold creation, payments, and booking retrieval
// ─────────────────────────────────────────────────────────────

import { pool } from '../../db/pool.js';

/**
 * Releases stale holds for a show so seats become free before new bookings
 */
export async function expireHoldsForShow(showId) {
  await pool.query('SELECT expire_holds($1);', [showId]);
}

/**
 * Retrieves show metadata inside a transaction
 */
export async function getShowForBooking(client, showId) {
  const query = `
    SELECT show_id, venue_id, start_time, end_time, status
    FROM show
    WHERE show_id = $1;
  `;
  const result = await client.query(query, [showId]);
  return result.rows[0] || null;
}

/**
 * Creates a PENDING booking record with a 5-minute hold_expires_at window
 */
export async function createPendingBooking(client, userId, showId) {
  const query = `
    INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status)
    VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING')
    RETURNING booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount;
  `;
  const result = await client.query(query, [userId, showId]);
  return result.rows[0];
}

/**
 * Inserts a HELD ticket. Database triggers automatically set price_paid,
 * enforce ticket limits, and sync booking total_amount.
 */
export async function createHeldTicket(client, { bookingId, showId, venueId, rowLabel, seatNo, attendeeType }) {
  const query = `
    INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
    VALUES ($1, $2, $3, $4, $5, $6, 0.00, 'HELD')
    RETURNING ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status;
  `;
  const result = await client.query(query, [
    bookingId,
    showId,
    venueId,
    rowLabel || null,
    seatNo || null,
    attendeeType,
  ]);
  return result.rows[0];
}

/**
 * Retrieves all tickets associated with a booking
 */
export async function getBookingTickets(clientOrPool, bookingId) {
  const executor = clientOrPool || pool;
  const query = `
    SELECT 
      t.ticket_id,
      t.booking_id,
      t.show_id,
      t.venue_id,
      t.row_label,
      t.seat_no,
      t.seat_no AS seat_number,
      t.attendee_type,
      t.price_paid,
      t.price_paid AS price,
      t.status,
      sc.name AS category_name
    FROM ticket t
    LEFT JOIN seat s ON (s.venue_id = t.venue_id AND s.row_label = t.row_label AND s.seat_no = t.seat_no)
    LEFT JOIN seat_category sc ON sc.category_id = s.category_id
    WHERE t.booking_id = $1
    ORDER BY t.ticket_id ASC;
  `;
  const result = await executor.query(query, [bookingId]);
  return result.rows;
}

/**
 * Retrieves booking record with total_amount refreshed after trigger sync
 */
export async function getBookingRow(clientOrPool, bookingId) {
  const executor = clientOrPool || pool;
  const query = `
    SELECT booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount
    FROM booking
    WHERE booking_id = $1;
  `;
  const result = await executor.query(query, [bookingId]);
  return result.rows[0] || null;
}

/**
 * Locks a booking row using SELECT ... FOR UPDATE during payment flow
 */
export async function lockBookingForUpdate(client, bookingId) {
  const query = `
    SELECT booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount
    FROM booking
    WHERE booking_id = $1
    FOR UPDATE;
  `;
  const result = await client.query(query, [bookingId]);
  return result.rows[0] || null;
}

/**
 * Updates a booking status to CONFIRMED
 */
export async function confirmBooking(client, bookingId) {
  const query = `
    UPDATE booking
    SET status = 'CONFIRMED'
    WHERE booking_id = $1
    RETURNING booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount;
  `;
  const result = await client.query(query, [bookingId]);
  return result.rows[0];
}

/**
 * Updates all HELD tickets for a booking to ACTIVE
 */
export async function activateTickets(client, bookingId) {
  const query = `
    UPDATE ticket
    SET status = 'ACTIVE'
    WHERE booking_id = $1 AND status = 'HELD'
    RETURNING ticket_id;
  `;
  const result = await client.query(query, [bookingId]);
  return result.rows;
}

/**
 * Inserts a payment record
 */
export async function recordPayment(client, { bookingId, amount, paymentMethod, gatewayRef, status = 'SUCCESS' }) {
  const paidAt = (status === 'SUCCESS' || status === 'REFUNDED') ? new Date().toISOString() : null;
  const query = `
    INSERT INTO payment (booking_id, amount, payment_method, status, gateway_ref, paid_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at;
  `;
  const result = await client.query(query, [
    bookingId,
    amount,
    paymentMethod,
    status,
    gatewayRef,
    paidAt,
  ]);
  return result.rows[0];
}

/**
 * Detailed booking view with event, show, venue, and payment data
 */
export async function getBookingById(bookingId) {
  const query = `
    SELECT 
      b.booking_id,
      b.user_id,
      b.show_id,
      b.booked_at,
      b.hold_expires_at,
      b.status,
      b.total_amount,
      s.start_time,
      s.end_time,
      s.venue_id,
      v.name AS venue_name,
      LOWER(v.venue_type) AS venue_type,
      e.event_id,
      e.title AS event_title,
      c.name AS club_name,
      p.payment_id,
      p.amount AS paid_amount,
      p.status AS payment_status,
      p.payment_method,
      p.gateway_ref,
      p.paid_at
    FROM booking b
    JOIN show s ON b.show_id = s.show_id
    JOIN venue v ON s.venue_id = v.venue_id
    JOIN event e ON s.event_id = e.event_id
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN LATERAL (
      SELECT payment_id, amount, status, payment_method, gateway_ref, paid_at
      FROM payment
      WHERE booking_id = b.booking_id
      ORDER BY payment_id DESC
      LIMIT 1
    ) p ON true
    WHERE b.booking_id = $1;
  `;
  const result = await pool.query(query, [bookingId]);
  return result.rows[0] || null;
}

/**
 * Retrieves attendee booking history with payment status
 */
export async function getUserBookings(userId) {
  const query = `
    SELECT 
      b.booking_id,
      b.show_id,
      b.booked_at,
      b.hold_expires_at,
      b.status,
      b.total_amount,
      s.start_time,
      s.end_time,
      v.name AS venue_name,
      LOWER(v.venue_type) AS venue_type,
      e.event_id,
      e.title AS event_title,
      c.name AS club_name,
      COUNT(t.ticket_id)::int AS ticket_count,
      p.status AS payment_status
    FROM booking b
    JOIN show s ON b.show_id = s.show_id
    JOIN venue v ON s.venue_id = v.venue_id
    JOIN event e ON s.event_id = e.event_id
    JOIN club c ON e.club_id = c.club_id
    LEFT JOIN ticket t ON b.booking_id = t.booking_id
    LEFT JOIN LATERAL (
      SELECT status FROM payment WHERE booking_id = b.booking_id ORDER BY payment_id DESC LIMIT 1
    ) p ON true
    WHERE b.user_id = $1
    GROUP BY b.booking_id, s.show_id, v.venue_id, v.name, v.venue_type, e.event_id, e.title, c.name, p.status
    ORDER BY b.booked_at DESC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Updates a booking status to CANCELLED.
 * Database trigger trg_booking_cancellation (BR10) automatically cascades:
 * - cancels all HELD / ACTIVE tickets
 * - refunds all SUCCESS payments
 */
export async function cancelBookingInDb(clientOrPool, bookingId) {
  const executor = clientOrPool || pool;
  const query = `
    UPDATE booking
    SET status = 'CANCELLED'
    WHERE booking_id = $1
    RETURNING booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount;
  `;
  const result = await executor.query(query, [bookingId]);
  return result.rows[0] || null;
}
