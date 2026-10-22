// ─────────────────────────────────────────────────────────────
// backend/src/modules/auth/auth.controller.js
// Request handlers for authentication endpoints
// ─────────────────────────────────────────────────────────────

import * as authService from './auth.service.js';

export async function register(req, res, next) {
  try {
    const result = await authService.registerUser(req.body);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.userId);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
