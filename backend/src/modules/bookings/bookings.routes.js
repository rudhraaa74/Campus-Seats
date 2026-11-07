// ─────────────────────────────────────────────────────────────
// backend/src/modules/bookings/bookings.routes.js
// Express router for seat holds, payments, and booking retrieval
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as bookingsController from './bookings.controller.js';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

// POST /api/v1/bookings (create 5-minute hold)
router.post('/', bookingsController.createBooking);

// GET /api/v1/bookings/mine (current user booking history) - must precede /:id
router.get('/mine', bookingsController.getMyBookings);

// GET /api/v1/bookings/:id (booking details)
router.get('/:id', bookingsController.getBookingById);

// POST /api/v1/bookings/:id/pay (confirm & pay)
router.post('/:id/pay', bookingsController.payBooking);

// POST /api/v1/bookings/:id/email-tickets (email confirmation & PDF tickets)
router.post('/:id/email-tickets', bookingsController.emailTickets);

// DELETE /api/v1/bookings/:id (cancel reservation & refund)
router.delete('/:id', bookingsController.cancelBooking);

export default router;
