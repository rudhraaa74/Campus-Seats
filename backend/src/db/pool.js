// ─────────────────────────────────────────────────────────────
// backend/src/db/pool.js
// PostgreSQL connection pool using node-postgres (pg)
// ─────────────────────────────────────────────────────────────

import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 20, // Maximum number of concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client pool:', err);
});

// Helper for executing single non-transactional queries
export const query = (text, params) => pool.query(text, params);
