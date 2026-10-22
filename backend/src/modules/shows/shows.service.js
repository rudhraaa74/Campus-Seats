// ─────────────────────────────────────────────────────────────
// backend/src/modules/shows/shows.service.js
// Business logic for show information, price matrix, and live seat maps
// ─────────────────────────────────────────────────────────────

import * as queries from './shows.queries.js';

/**
 * Retrieves show details, event, venue, and structured price matrix
 */
export async function getShowDetail(showId) {
  const show = await queries.getShowById(showId);
  if (!show) {
    const error = new Error('Show not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const rawPrices = await queries.getShowPrices(showId);

  // Group pricing tiers by category
  const priceMap = new Map();
  for (const row of rawPrices) {
    if (!priceMap.has(row.category_id)) {
      priceMap.set(row.category_id, {
        category_id: row.category_id,
        category_name: row.category_name,
        student_price: null,
        faculty_price: null,
        guest_price: null,
      });
    }
    const item = priceMap.get(row.category_id);
    const numPrice = parseFloat(row.price);
    if (row.user_type === 'STUDENT') item.student_price = numPrice;
    if (row.user_type === 'FACULTY') item.faculty_price = numPrice;
    if (row.user_type === 'GUEST') item.guest_price = numPrice;
  }

  const prices = Array.from(priceMap.values());

  return {
    show: {
      show_id: show.show_id,
      event: {
        event_id: show.event_id,
        title: show.event_title,
        event_type: show.event_type,
        description: show.event_description,
        duration_min: show.duration_min,
      },
      club: {
        club_id: show.club_id,
        club_name: show.club_name,
      },
      venue: {
        venue_id: show.venue_id,
        name: show.venue_name,
        venue_name: show.venue_name,
        venue_type: show.venue_type,
        capacity: show.capacity,
      },
      start_time: show.start_time,
      end_time: show.end_time,
      status: show.status,
      prices,
    },
  };
}

/**
 * Retrieves live seat availability for a show.
 * Enforces hold expiration prior to reading live tickets.
 */
export async function getShowSeats(showId) {
  // Step 1: Run expire_holds(show_id) so stale holds do not block seats
  await queries.expireHoldsForShow(showId);

  // Step 2: Retrieve show & venue details
  const show = await queries.getShowById(showId);
  if (!show) {
    const error = new Error('Show not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Step 3: Handle Auditorium vs Classroom venue types
  if (show.venue_type === 'auditorium') {
    const seats = await queries.getAuditoriumSeats(showId, show.venue_id);
    return {
      show_id: show.show_id,
      venue_id: show.venue_id,
      venue_name: show.venue_name,
      venue_type: 'auditorium',
      seats,
    };
  } else {
    const status = await queries.getClassroomSeatStatus(showId, show.venue_id);
    return {
      show_id: show.show_id,
      venue_id: show.venue_id,
      venue_name: status?.venue_name || show.venue_name,
      venue_type: 'classroom',
      capacity: status?.capacity || show.capacity || 0,
      booked_count: status?.booked_count || 0,
      remaining: status?.remaining ?? (show.capacity || 0),
      category_id: status?.category_id || null,
      category_name: status?.category_name || 'General',
    };
  }
}
