// ─────────────────────────────────────────────────────────────
// backend/src/modules/shows/shows.controller.js
// Request handlers for show details and seat map
// ─────────────────────────────────────────────────────────────

import * as showsService from './shows.service.js';
import { seatEvents } from '../../events/seatEvents.js';

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

    const result = await showsService.getShowDetail(showId, req.user);
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

    const result = await showsService.getShowSeats(showId, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/shows/:id/stream
 * Server-Sent Events (SSE) stream notifying watching clients when seats change.
 * Clients re-query GET /api/v1/shows/:id/seats; no seat diffs sent.
 */
export function streamShowUpdates(req, res) {
  const showId = parseInt(req.params.id, 10);
  if (isNaN(showId)) {
    return res.status(400).end();
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // Flush initial connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', showId })}\n\n`);

  const onUpdate = () => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'REFRESH', showId })}\n\n`);
    } catch (e) {
      // client disconnected
    }
  };

  const channel = `show:${showId}`;
  seatEvents.on(channel, onUpdate);
  seatEvents.on('show:all', onUpdate);

  // Heartbeat comment every 20 seconds to prevent connection timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    seatEvents.off(channel, onUpdate);
    seatEvents.off('show:all', onUpdate);
    res.end();
  });
}

