// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.service.js
// Business logic for event listing, searching, and detail views
// ─────────────────────────────────────────────────────────────

import * as queries from './events.queries.js';

/**
 * List events with search query, filters, sorting, and pagination
 */
export async function listEvents({ type, club_id, from, to, q, sort, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    queries.getEventsList({
      type,
      club_id,
      from,
      to,
      q,
      sort,
      limit: limitNum,
      offset,
    }),
    queries.getEventsCount({
      type,
      club_id,
      from,
      to,
      q,
    }),
  ]);

  return {
    events,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Get detailed event record with its scheduled shows
 */
export async function getEventDetail(eventId) {
  const event = await queries.getEventById(eventId);
  if (!event) {
    const error = new Error('Event not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const shows = await queries.getShowsByEventId(eventId);

  return {
    event: {
      event_id: event.event_id,
      title: event.title,
      description: event.description,
      type: event.type,
      event_type: event.event_type,
      duration_min: event.duration_min,
      club: {
        club_id: event.club_id,
        club_name: event.club_name,
        club_email: event.club_email,
      },
      shows,
    },
  };
}

/**
 * Get available filter criteria (clubs, categories)
 */
export async function getFilterOptions() {
  const clubs = await queries.getClubsList();
  const types = ['CULTURAL', 'TECHNICAL', 'SPORTS', 'ACADEMIC', 'OTHER'];
  return { clubs, types };
}
