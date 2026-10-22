// ─────────────────────────────────────────────────────────────
// backend/src/modules/shows/shows.controller.js
// Request handlers for show details and seat map
// ─────────────────────────────────────────────────────────────

import * as showsService from './shows.service.js';

/**
 * GET /api/v1/shows/:id
 * Retrieves show details, event, venue, and pricing matrix
 */
export async function getShowById(req, res, next) {
  try {
    const showId = parseInt(req.params.id, 10);
    if (isNaN(showId)) {
      const error = new Error('Invalid show ID parameter.');
      error.status = 400;
      error.code = 'INVALID_PARAMETER';
      throw error;
    }

    const result = await showsService.getShowDetail(showId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/shows/:id/seats
 * Retrieves current real-time seat status for the show
 */
export async function getShowSeats(req, res, next) {
  try {
    const showId = parseInt(req.params.id, 10);
    if (isNaN(showId)) {
      const error = new Error('Invalid show ID parameter.');
      error.status = 400;
      error.code = 'INVALID_PARAMETER';
      throw error;
    }

    const result = await showsService.getShowSeats(showId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
