// ─────────────────────────────────────────────────────────────
// backend/src/modules/organizer/organizer.routes.js
// Express router for club manager organizer workflow (W4)
// Protected by JWT authentication and requireClubManager (BR11)
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireClubManager } from '../../middleware/requireClubManager.js';
import * as organizerController from './organizer.controller.js';

const router = Router();

// All organizer endpoints require authentication and club manager authorization
router.use(authenticate);
router.use(requireClubManager);

// Venues and categories
router.get('/venues', organizerController.getVenues);

// Events management
router.get('/events', organizerController.getEvents);
router.post('/events', organizerController.createEvent);
router.put('/events/:id', organizerController.updateEvent);

// Shows management
router.post('/shows', organizerController.createShow);
router.post('/shows/:id/cancel', organizerController.cancelShow);

// Show pricing matrix
router.put('/shows/:id/prices', organizerController.updateShowPrices);

export default router;
