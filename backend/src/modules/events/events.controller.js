// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.controller.js
// Request handlers for event browsing and search
// ─────────────────────────────────────────────────────────────

import * as eventsService from './events.service.js';

/**
 * GET /api/v1/events
 * Handles search, filtering, and pagination
 */
export async function getEvents(req, res, next) {
  try {
    const { type, club_id, from, to, q, sort, page, limit, audience } = req.query;
    const result = await eventsService.listEvents({
      type,
      club_id,
      from,
      to,
      q,
      sort,
      page,
      limit,
      audience,
      user: req.user,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/events/:id
 * Retrieves a single event and its upcoming shows
 */
export async function getEventById(req, res, next) {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) {
      const error = new Error('Invalid event ID parameter.');
      error.status = 400;
      error.code = 'INVALID_PARAMETER';
      throw error;
    }

    const result = await eventsService.getEventDetail(eventId, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/events/filters
 * Returns club lists and categories for UI filter inputs
 */
export async function getFilterOptions(req, res, next) {
  try {
    const result = await eventsService.getFilterOptions();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
