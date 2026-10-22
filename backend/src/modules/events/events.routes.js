// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.routes.js
// Express router for event browsing endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as eventsController from './events.controller.js';

const router = Router();

// GET /api/v1/events/filters (must precede /:id)
router.get('/filters', eventsController.getFilterOptions);

// GET /api/v1/events (list, search, filter, paginate)
router.get('/', eventsController.getEvents);

// GET /api/v1/events/:id (detail with shows)
router.get('/:id', eventsController.getEventById);

export default router;
