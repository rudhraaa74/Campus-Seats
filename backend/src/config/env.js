// ─────────────────────────────────────────────────────────────
// backend/src/config/env.js
// Loads and validates required environment variables at startup
// ─────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from backend/.env if present, else fallback to root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // PostgreSQL configuration (defaults match docker-compose.yml)
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
    user: process.env.POSTGRES_USER || 'seatsync',
    password: process.env.POSTGRES_PASSWORD || 'seatsync_dev',
    database: process.env.POSTGRES_DB || 'seatsync',
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'seatsync-super-secret-jwt-key-2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Email & OTP verification configuration
  otp: {
    ttlSeconds: 600, // 10 minutes
    resendCooldownSeconds: 60, // 1 minute
    maxAttempts: 5,
    demoMode: process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true',
  },

  campus: {
    // Institutional email domain(s) for STUDENT and FACULTY registrations.
    // In test environment, also appends 'seatsync.ac.in' so existing integration tests run cleanly.
    allowedDomains: Array.from(new Set([
      ...(process.env.CAMPUS_EMAIL_DOMAINS || 'hyderabad.bits-pilani.ac.in')
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      ...(process.env.NODE_ENV === 'test' ? ['seatsync.ac.in', 'campus.ac.in'] : []),
    ])),
  },

  smtp: {
    service: process.env.SMTP_SERVICE || '',
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from:
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER
        ? `SeatSync <${process.env.SMTP_USER}>`
        : 'SeatSync <no-reply@hyderabad.bits-pilani.ac.in>'),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    enabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  },
};

// Validate critical production configurations
if (env.nodeEnv === 'production' && env.jwt.secret === 'seatsync-super-secret-jwt-key-2026') {
  console.warn('WARNING: Running with default JWT_SECRET in production mode.');
}
