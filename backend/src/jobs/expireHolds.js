// ─────────────────────────────────────────────────────────────
// backend/src/jobs/expireHolds.js
// 30-second recurring background job running expire_holds() safety net
// ─────────────────────────────────────────────────────────────

import cron from 'node-cron';
import { pool } from '../db/pool.js';

/**
 * Starts the 30-second safety net cron job.
 * Executes SELECT expire_holds() in PostgreSQL to ensure no stale holds linger.
 */
export function startHoldExpiryCron() {
  // Cron schedule: every 30 seconds
  const task = cron.schedule('*/30 * * * * *', async () => {
    try {
      await pool.query('SELECT expire_holds();');
    } catch (err) {
      console.error('[Expire Holds Cron] Error executing expire_holds():', err.message);
    }
  });

  console.log('✓ Hold-expiry safety net cron scheduled (every 30 seconds)');
  return task;
}
