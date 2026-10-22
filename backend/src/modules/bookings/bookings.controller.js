// ─────────────────────────────────────────────────────────────
// backend/src/modules/bookings/bookings.controller.js
// Request handlers for bookings, seat holds, and payments
// ─────────────────────────────────────────────────────────────

import * as bookingsService from './bookings.service.js';

/**
 * POST /api/v1/bookings
 * Holds seats for 5 minutes and returns the pending booking
 */
export async function createBooking(req, res, next) {
  try {
    const { show_id, tickets, ticket_count } = req.body;
    const userId = req.user.userId;
    const userType = req.user.userType;

    const result = await bookingsService.createHold({
      userId,
      userType,
      showId: parseInt(show_id, 10),
      tickets,
      ticketCount: ticket_count,
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/bookings/:id/pay
 * Simulates gateway payment and confirms held booking
 */
export async function payBooking(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    const { payment_method, simulate_failure } = req.body;

    const result = await bookingsService.payBooking({
      bookingId,
      userId,
      paymentMethod: payment_method || 'UPI',
      simulateFailure: Boolean(simulate_failure),
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/bookings/mine
 * Retrieves the current authenticated user's booking history
 */
export async function getMyBookings(req, res, next) {
  try {
    const userId = req.user.userId;
    const result = await bookingsService.getUserBookingsList(userId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/bookings/:id
 * Retrieves booking details by ID
 */
export async function getBookingById(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.user.userId;

    const result = await bookingsService.getBookingDetail(bookingId, userId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/bookings/:id
 * Cancels a booking, cascades ticket cancellations and refunds payments (BR10)
 */
export async function cancelBooking(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    const userClubIds = req.user.clubIds || [];

    const result = await bookingsService.cancelBooking(bookingId, userId, userClubIds);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
