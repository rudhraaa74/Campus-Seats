// ─────────────────────────────────────────────────────────────
// backend/src/index.js
// Server entry point — binds HTTP port and initializes jobs
// ─────────────────────────────────────────────────────────────

import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`===============================================`);
  console.log(`✓ SeatSync API Server running on port ${env.port}`);
  console.log(`  Environment: ${env.nodeEnv}`);
  console.log(`  Health Check: http://localhost:${env.port}/api/v1/health`);
  console.log(`===============================================`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});
