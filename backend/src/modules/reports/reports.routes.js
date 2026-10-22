// ─────────────────────────────────────────────────────────────
// backend/src/modules/reports/reports.routes.js
// Protected API routes for club manager analytics and reports
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireClubManager } from '../../middleware/requireClubManager.js';
import * as reportsController from './reports.controller.js';

const router = Router();

// All reporting endpoints require an authenticated club manager (Rule BR11)
router.use(authenticate);
router.use(requireClubManager);

// High-level KPI summary
router.get('/summary', reportsController.getSummary);

// 1. Show Occupancy Analysis
router.get('/occupancy', reportsController.getOccupancy);

// 2. Revenue Breakdown by Event and Attendee Type
router.get('/revenue', reportsController.getRevenue);

// 3. Top Ranked Events by Revenue
router.get('/top-events', reportsController.getTopEvents);

// 4. Shows with Seats Still Free / No Live Tickets
router.get('/unsold-shows', reportsController.getUnsoldShows);

// 5. Most Active Attendees
router.get('/active-attendees', reportsController.getActiveAttendees);

// 6. Auditorium Row Utilization
router.get('/row-utilization', reportsController.getRowUtilization);

export default router;
