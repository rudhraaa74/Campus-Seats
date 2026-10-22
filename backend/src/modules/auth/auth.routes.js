// ─────────────────────────────────────────────────────────────
// backend/src/modules/auth/auth.routes.js
// Authentication routes (/api/v1/auth)
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);

export default router;
