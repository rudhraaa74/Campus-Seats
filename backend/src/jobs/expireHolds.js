// ─────────────────────────────────────────────────────────────
// backend/src/jobs/expireHolds.js
// 30-second recurring background job running expire_holds() safety net
// ─────────────────────────────────────────────────────────────

import cron from 'node-cron';
import { pool } from '../db/pool.js';
import { notifyAllShowsUpdated } from '../events/seatEvents.js';

/**
 * Starts the safety net cron job.
 * Executes SELECT expire_holds() in PostgreSQL to ensure no stale holds linger.
 * If any stale holds were cleared, emits an SSE refresh event to all connected clients.
 */
export function startHoldExpiryCron() {
  // Cron schedule: every 10 seconds
  const task = cron.schedule('*/10 * * * * *', async () => {
    try {
      const res = await pool.query('SELECT expire_holds();');
      const expiredCount = res.rows[0]?.expire_holds || 0;
      if (expiredCount > 0) {
        notifyAllShowsUpdated();
      }
    } catch (err) {
      console.error('[Expire Holds Cron] Error executing expire_holds():', err.message);
    }
  });

  console.log('✓ Hold-expiry safety net cron scheduled (every 10 seconds)');
  return task;
}
