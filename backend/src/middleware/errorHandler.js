// ─────────────────────────────────────────────────────────────
// backend/src/middleware/errorHandler.js
// Global Express error handling middleware
// ─────────────────────────────────────────────────────────────

import { mapDatabaseError } from '../db/errors.js';

export function errorHandler(err, req, res, next) {
  // 1. Handle custom application errors (which explicitly specify err.status)
  if (err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      },
    });
  }

  // 2. Check if this is a PostgreSQL error (has a PostgreSQL SQLSTATE code or constraint property)
  if (err.code || err.constraint) {
    const { status, body } = mapDatabaseError(err);
    return res.status(status).json(body);
  }

  // Fallback for unhandled exceptions
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  });
}
