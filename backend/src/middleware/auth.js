// ─────────────────────────────────────────────────────────────
// backend/src/middleware/auth.js
// Verifies JWT token and attaches authenticated user payload
// ─────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.user = payload; // payload contains: { userId, userType, clubIds }
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      },
    });
  }
}

/**
 * Optional authentication middleware:
 * If Authorization Bearer header is present and valid, attaches req.user.
 * Otherwise sets req.user = null and continues without error.
 */
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.user = payload;
  } catch (err) {
    req.user = null;
  }
  next();
}

