// ─────────────────────────────────────────────────────────────
// backend/src/redis/client.js
// Redis connection client (used for 5-minute hold timers)
// ─────────────────────────────────────────────────────────────

import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  lazyConnect: true, // Do not block server startup if Redis is temporarily offline
  retryStrategy: (times) => {
    // Retry connection with exponential backoff capped at 3s
    return Math.min(times * 100, 3000);
  },
});

redis.on('connect', () => {
  console.log('✓ Connected to Redis');
});

redis.on('error', (err) => {
  console.warn('Redis notice (running in degraded timer mode if offline):', err.message);
});
