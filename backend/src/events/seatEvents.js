// ─────────────────────────────────────────────────────────────
// backend/src/events/seatEvents.js
// Node.js EventEmitter for broadcasting live seat map refresh signals
// via Server-Sent Events (SSE). No seat diffs are transmitted;
// clients simply re-query PostgreSQL to keep the DBMS as ground truth.
// ─────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';

export const seatEvents = new EventEmitter();

// Allow up to 200 concurrent client listeners per show channel
seatEvents.setMaxListeners(200);

/**
 * Emits a refresh signal to all clients watching a given showId.
 */
export function notifyShowUpdated(showId) {
  if (showId) {
    seatEvents.emit(`show:${showId}`, { timestamp: Date.now() });
  }
}

/**
 * Emits a global refresh signal (e.g. when safety-net cron sweeps holds).
 */
export function notifyAllShowsUpdated() {
  seatEvents.emit('show:all', { timestamp: Date.now() });
}
