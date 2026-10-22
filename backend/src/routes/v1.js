// ─────────────────────────────────────────────────────────────
// backend/src/routes/v1.js
// Mounts all modular API endpoints under /api/v1
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import { pool } from '../db/pool.js';
import { redis } from '../redis/client.js';

const router = Router();

// Module Routes
router.use('/auth', authRoutes);

// System Health Check Endpoint
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    postgres: 'disconnected',
    redis: 'disconnected',
  };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    health.postgres = 'connected';
  } catch (err) {
    health.postgres = 'error';
    health.status = 'degraded';
    health.postgresError = err.message;
  }

  // Check Redis
  try {
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      health.redis = 'connected';
    }
  } catch (err) {
    health.redis = 'error';
    health.status = 'degraded';
    health.redisError = err.message;
  }

  const statusCode = health.status === 'healthy' ? 200 : 207;
  return res.status(statusCode).json(health);
});

export default router;
