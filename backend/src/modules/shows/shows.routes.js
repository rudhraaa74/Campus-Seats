// ─────────────────────────────────────────────────────────────
// backend/src/modules/shows/shows.routes.js
// Express router for show details and seat status endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as showsController from './shows.controller.js';

const router = Router();

// GET /api/v1/shows/:id (details & prices)
router.get('/:id', showsController.getShowById);

// GET /api/v1/shows/:id/seats (real-time seat status / remaining slots)
router.get('/:id/seats', showsController.getShowSeats);

export default router;
