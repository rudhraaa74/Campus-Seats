// ─────────────────────────────────────────────────────────────
// backend/src/redis/holds.js
// 5-minute hold timer management and keyspace expiry subscriber
// ─────────────────────────────────────────────────────────────

import { redis } from './client.js';
import { pool } from '../db/pool.js';

const HOLD_PREFIX = 'hold:';

/**
 * Sets a 5-minute hold timer key in Redis: hold:{booking_id}
 * @param {number|string} bookingId
 * @param {number} ttlSeconds Default 300s (5 minutes)
 */
export async function setHold(bookingId, ttlSeconds = 300) {
  try {
    const key = `${HOLD_PREFIX}${bookingId}`;
    await redis.set(key, '1', 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`[Redis Hold] Warning: failed to set Redis key for booking ${bookingId}:`, err.message);
  }
}

/**
 * Deletes the hold timer key upon successful payment or explicit cancellation
 * @param {number|string} bookingId
 */
export async function clearHold(bookingId) {
  try {
    const key = `${HOLD_PREFIX}${bookingId}`;
    await redis.del(key);
  } catch (err) {
    console.warn(`[Redis Hold] Warning: failed to clear Redis key for booking ${bookingId}:`, err.message);
  }
}

/**
 * Checks remaining TTL for a booking hold
 * @param {number|string} bookingId
 * @returns {Promise<number>} Remaining seconds, or -1 if not found / expired
 */
export async function getHoldTtl(bookingId) {
  try {
    const key = `${HOLD_PREFIX}${bookingId}`;
    return await redis.ttl(key);
  } catch (err) {
    return -1;
  }
}

/**
 * Starts a dedicated subscriber listening for Redis key-expiry events.
 * When hold:{booking_id} expires, triggers PostgreSQL expire_holds() to free the seats.
 */
export function startHoldExpirySubscriber() {
  try {
    const sub = redis.duplicate();

    sub.on('error', (err) => {
      console.warn('[Redis Subscriber] Connection notice:', err.message);
    });

    sub.subscribe('__keyevent@0__:expired', (err) => {
      if (err) {
        console.warn('[Redis Subscriber] Failed to subscribe to key-expiry events:', err.message);
      } else {
        console.log('✓ Redis hold-expiry subscriber active (__keyevent@0__:expired)');
      }
    });

    sub.on('message', async (channel, message) => {
      if (message.startsWith(HOLD_PREFIX)) {
        const bookingId = parseInt(message.replace(HOLD_PREFIX, ''), 10);
        if (!isNaN(bookingId)) {
          try {
            console.log(`[Redis Expiry] Hold expired for booking ${bookingId}. Releasing seats...`);
            await pool.query('SELECT expire_holds();');
          } catch (dbErr) {
            console.error(`[Redis Expiry] Error running expire_holds for booking ${bookingId}:`, dbErr.message);
          }
        }
      }
    });

    return sub;
  } catch (err) {
    console.warn('[Redis Subscriber] Could not initialize subscriber:', err.message);
    return null;
  }
}
