// ─────────────────────────────────────────────────────────────
// backend/src/modules/events/events.routes.js
// Express router for event browsing endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { optionalAuthenticate } from '../../middleware/auth.js';
import * as eventsController from './events.controller.js';

const router = Router();

// GET /api/v1/events/filters (must precede /:id)
router.get('/filters', eventsController.getFilterOptions);

// GET /api/v1/events (list, search, filter, paginate)
router.get('/', optionalAuthenticate, eventsController.getEvents);

// GET /api/v1/events/:id (detail with shows)
router.get('/:id', optionalAuthenticate, eventsController.getEventById);

export default router;
