// ─────────────────────────────────────────────────────────────
// backend/src/index.js
// Server entry point — binds HTTP port and initializes jobs
// ─────────────────────────────────────────────────────────────

import { app } from './app.js';
import { env } from './config/env.js';
import { startHoldExpirySubscriber } from './redis/holds.js';
import { startHoldExpiryCron } from './jobs/expireHolds.js';

const server = app.listen(env.port, () => {
  console.log(`===============================================`);
  console.log(`✓ SeatSync API Server running on port ${env.port}`);
  console.log(`  Environment: ${env.nodeEnv}`);
  console.log(`  Health Check: http://localhost:${env.port}/api/v1/health`);
  console.log(`===============================================`);

  // Initialize Redis hold subscriber & safety-net cron
  startHoldExpirySubscriber();
  startHoldExpiryCron();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
});

