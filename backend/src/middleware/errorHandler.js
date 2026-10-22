// ─────────────────────────────────────────────────────────────
// backend/src/middleware/errorHandler.js
// Global Express error handling middleware
// ─────────────────────────────────────────────────────────────

import { mapDatabaseError } from '../db/errors.js';

export function errorHandler(err, req, res, next) {
  // Check if this is a PostgreSQL error (has a code or constraint property)
  if (err.code || err.constraint) {
    const { status, body } = mapDatabaseError(err);
    return res.status(status).json(body);
  }

  // Handle custom application errors
  if (err.status && err.code) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
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
