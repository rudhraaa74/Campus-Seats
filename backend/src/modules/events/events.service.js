// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.service.js
// Business logic for event listing, searching, and detail views
// ─────────────────────────────────────────────────────────────

import * as queries from './events.queries.js';

/**
 * List events with search query, filters, sorting, and pagination
 */
export async function listEvents({ type, club_id, from, to, q, sort, page = 1, limit = 20, audience, user }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Determine audience filtering:
  // If user is a club manager and not explicitly filtering, they can see all events.
  // Otherwise, filter by the user's role (STUDENT, FACULTY, or GUEST).
  const isClubManager = user?.clubIds && user.clubIds.length > 0;
  let audienceUserType = null;
  if (!isClubManager) {
    audienceUserType = (user?.userType || 'GUEST').toUpperCase();
  } else if (audience && audience !== 'ALL') {
    audienceUserType = audience.toUpperCase();
  }

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
      audienceUserType,
    }),
    queries.getEventsCount({
      type,
      club_id,
      from,
      to,
      q,
      audienceUserType,
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
export async function getEventDetail(eventId, user = null) {
  const event = await queries.getEventById(eventId);
  if (!event) {
    const error = new Error('Event not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const isClubManager = user?.clubIds && user.clubIds.includes(event.club_id);
  const audienceUserType = isClubManager ? null : (user?.userType || 'GUEST').toUpperCase();

  const shows = await queries.getShowsByEventId(eventId, audienceUserType);

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
