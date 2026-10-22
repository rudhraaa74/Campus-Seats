// ─────────────────────────────────────────────────────────────
// backend/src/modules/bookings/bookings.service.js
// Business logic for seat holds, timer setting, payment processing & confirmation
// ─────────────────────────────────────────────────────────────

import { withTransaction } from '../../db/transaction.js';
import * as queries from './bookings.queries.js';
import { setHold, clearHold } from '../../redis/holds.js';
import { notifyShowUpdated } from '../../events/seatEvents.js';

/**
 * Creates a 5-minute seat hold (PENDING booking + HELD tickets) in a transaction,
 * and sets the Redis hold timer only after transaction commit.
 */
export async function createHold({ userId, userType, showId, tickets = [], ticketCount = 1 }) {
  if (!showId) {
    const error = new Error('show_id is required.');
    error.status = 400;
    error.code = 'INVALID_PARAMETER';
    throw error;
  }

  // 1. Release stale holds for this show prior to booking so available seats are up to date
  await queries.expireHoldsForShow(showId);

  // 2. Execute booking and ticket creation inside transaction
  const { booking, ticketList } = await withTransaction(async (client) => {
    // Verify show status and booking window
    const show = await queries.getShowForBooking(client, showId);
    if (!show) {
      const error = new Error('Show does not exist.');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (show.status !== 'SCHEDULED') {
      const error = new Error(`Cannot book show with status: ${show.status}`);
      error.status = 422;
      error.code = 'SHOW_NOT_BOOKABLE';
      throw error;
    }

    if (new Date(show.start_time) <= new Date()) {
      const error = new Error('Cannot book tickets for a show that has already started.');
      error.status = 422;
      error.code = 'SHOW_NOT_BOOKABLE';
      throw error;
    }

    if (show.allowed_attendees && !show.allowed_attendees.includes((userType || '').toUpperCase())) {
      const error = new Error(`This event is restricted and not open to ${(userType || 'guest').toLowerCase()} attendees.`);
      error.status = 403;
      error.code = 'AUDIENCE_RESTRICTED';
      throw error;
    }

    // Insert PENDING booking (5-minute hold_expires_at)
    const newBooking = await queries.createPendingBooking(client, userId, showId);

    // Insert HELD tickets
    // Case A: Auditorium (seat list with row_label and seat_no)
    if (tickets && tickets.length > 0) {
      if (tickets.length > 6) {
        const error = new Error('A maximum of 6 tickets can be booked at once.');
        error.status = 422;
        error.code = 'TICKET_LIMIT';
        throw error;
      }

      const primaryType = (userType || 'STUDENT').toUpperCase();

      for (const t of tickets) {
        // Default to user's registered type (students book for other students at student rate)
        const attendeeType = (t.attendee_type || primaryType).toUpperCase();

        await queries.createHeldTicket(client, {
          bookingId: newBooking.booking_id,
          showId,
          venueId: show.venue_id,
          rowLabel: t.row_label,
          seatNo: t.seat_no || t.seat_number,
          attendeeType,
        });
      }
    } else {
      // Case B: Classroom general admission
      const count = Math.max(1, parseInt(ticketCount, 10) || 1);
      if (count > 6) {
        const error = new Error('A maximum of 6 tickets can be booked at once.');
        error.status = 422;
        error.code = 'TICKET_LIMIT';
        throw error;
      }

      const primaryType = (userType || 'STUDENT').toUpperCase();
      for (let i = 0; i < count; i++) {
        await queries.createHeldTicket(client, {
          bookingId: newBooking.booking_id,
          showId,
          venueId: show.venue_id,
          rowLabel: null,
          seatNo: null,
          attendeeType: primaryType,
        });
      }
    }

    // Retrieve refreshed booking (with trigger-synced total_amount) and tickets
    const refreshedBooking = await queries.getBookingRow(client, newBooking.booking_id);
    const createdTickets = await queries.getBookingTickets(client, newBooking.booking_id);

    return { booking: refreshedBooking, ticketList: createdTickets };
  });

  // 3. Set Redis 5-minute hold key ONLY after transaction successfully commits
  await setHold(booking.booking_id, 300);

  // 4. Notify live SSE clients watching this show to refresh their seat map
  notifyShowUpdated(showId);

  return {
    booking: {
      booking_id: booking.booking_id,
      user_id: booking.user_id,
      show_id: booking.show_id,
      status: booking.status,
      hold_expires_at: booking.hold_expires_at,
      total_amount: parseFloat(booking.total_amount),
      tickets: ticketList.map((t) => ({
        ticket_id: t.ticket_id,
        seat_id: t.seat_no,
        row_label: t.row_label,
        seat_no: t.seat_no,
        seat_number: t.seat_no,
        attendee_type: t.attendee_type,
        price: parseFloat(t.price_paid),
        price_paid: parseFloat(t.price_paid),
        status: t.status,
        category_name: t.category_name,
      })),
    },
  };
}

/**
 * Completes payment for a held booking in a single transaction.
 * Locks booking with SELECT ... FOR UPDATE, records payment, sets CONFIRMED, and clears Redis key.
 */
export async function payBooking({ bookingId, userId, paymentMethod = 'UPI', simulateFailure = false }) {
  const result = await withTransaction(async (client) => {
    // 1. Lock the booking row
    const booking = await queries.lockBookingForUpdate(client, bookingId);
    if (!booking) {
      const error = new Error('Booking not found.');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // 2. Authorization check
    if (booking.user_id !== userId) {
      const error = new Error('You are not authorized to pay for this booking.');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // 3. Status checks
    if (booking.status === 'CONFIRMED') {
      // Idempotently return existing confirmation on double-tap or retry
      const payment = await queries.getSuccessfulPaymentByBookingId(client, bookingId);
      return {
        booking,
        payment: payment || {
          payment_id: null,
          amount: booking.total_amount,
          payment_method: 'UPI',
          status: 'SUCCESS',
          paid_at: booking.booked_at,
        },
      };
    }

    if (booking.status === 'CANCELLED') {
      const error = new Error('This booking has been cancelled and cannot be paid.');
      error.status = 409;
      error.code = 'ALREADY_CANCELLED';
      throw error;
    }

    // 4. Hold expiry check (PostgreSQL timestamp is ground truth)
    // 4. Hold expiry check (PostgreSQL timestamp is ground truth)
    if (new Date() > new Date(booking.hold_expires_at) || booking.status === 'EXPIRED') {
      const error = new Error('The 5-minute hold has lapsed and seats were released.');
      error.status = 410;
      error.code = 'HOLD_EXPIRED';
      throw error;
    }

    // Normalize payment method to CHECK constraint values
    let normalizedMethod = (paymentMethod || 'UPI').toUpperCase();
    if (normalizedMethod.includes('SIMULAT')) normalizedMethod = 'SIMULATED';
    else if (normalizedMethod.includes('DEBIT')) normalizedMethod = 'DEBIT_CARD';
    else if (normalizedMethod.includes('CARD') || normalizedMethod.includes('CREDIT')) normalizedMethod = 'CREDIT_CARD';
    else if (normalizedMethod.includes('NET') || normalizedMethod.includes('BANK')) normalizedMethod = 'NET_BANKING';
    else if (normalizedMethod !== 'UPI') normalizedMethod = 'UPI';

    // 5. Simulated payment gateway failure test option
    const gatewayRef = `GATEWAY_${Date.now()}_${bookingId}`;
    if (simulateFailure) {
      // Record failed payment attempt in audit history (paid_at is NULL)
      await queries.recordPayment(client, {
        bookingId,
        amount: booking.total_amount,
        paymentMethod: normalizedMethod,
        gatewayRef,
        status: 'FAILED',
      });
      const error = new Error('Payment gateway declined the transaction. Please try another payment method.');
      error.status = 422;
      error.code = 'PAYMENT_FAILED';
      throw error;
    }

    // 6. Record successful payment
    const payment = await queries.recordPayment(client, {
      bookingId,
      amount: booking.total_amount,
      paymentMethod: normalizedMethod,
      gatewayRef,
      status: 'SUCCESS',
    });

    // 7. Update booking status to CONFIRMED
    const updatedBooking = await queries.confirmBooking(client, bookingId);

    // 8. Activate tickets from HELD to ACTIVE
    await queries.activateTickets(client, bookingId);

    return { booking: updatedBooking, payment };
  });

  // 9. Remove Redis hold key now that booking is confirmed
  await clearHold(bookingId);

  // 10. Notify live SSE clients watching this show
  notifyShowUpdated(result.booking.show_id);

  return {
    booking: {
      booking_id: result.booking.booking_id,
      user_id: result.booking.user_id,
      show_id: result.booking.show_id,
      status: result.booking.status,
      total_amount: parseFloat(result.booking.total_amount),
      payment: {
        payment_id: result.payment.payment_id,
        amount: parseFloat(result.payment.amount),
        payment_method: result.payment.payment_method,
        status: result.payment.status,
        gateway_ref: result.payment.gateway_ref,
        paid_at: result.payment.paid_at,
      },
    },
  };
}

/**
 * Retrieves booking details by ID
 */
export async function getBookingDetail(bookingId, userId) {
  const booking = await queries.getBookingById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (booking.user_id !== userId) {
    const error = new Error('You do not have permission to view this booking.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  const tickets = await queries.getBookingTickets(null, bookingId);

  return {
    booking: {
      ...booking,
      total_amount: parseFloat(booking.total_amount),
      tickets,
    },
  };
}

/**
 * Retrieves booking history for current attendee
 */
export async function getUserBookingsList(userId) {
  const bookings = await queries.getUserBookings(userId);
  return {
    bookings: bookings.map((b) => ({
      ...b,
      total_amount: parseFloat(b.total_amount),
    })),
  };
}

/**
 * Cancels a booking (Workflow W3).
 * Rely on BR10 triggers:
 * - When booking.status = 'CANCELLED', PostgreSQL trigger fn_cascade_booking_cancellation
 *   cancels all tickets and refunds any successful payment.
 * Also clears the Redis hold timer.
 */
export async function cancelBooking(bookingId, userId, userClubIds = []) {
  const booking = await queries.getBookingById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Authorization: user must own the booking OR be a club manager
  const isOwner = booking.user_id === userId;
  const isClubManager = userClubIds && userClubIds.length > 0;

  if (!isOwner && !isClubManager) {
    const error = new Error('You do not have permission to cancel this booking.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (booking.status === 'CANCELLED') {
    const error = new Error('This booking has already been cancelled.');
    error.status = 400;
    error.code = 'BOOKING_ALREADY_CANCELLED';
    throw error;
  }

  // Check if show has already started
  if (booking.start_time && new Date(booking.start_time) <= new Date()) {
    const error = new Error('Cannot cancel a booking for a show that has already started.');
    error.status = 400;
    error.code = 'SHOW_ALREADY_STARTED';
    throw error;
  }

  // Execute cancellation in database
  await queries.cancelBookingInDb(null, bookingId);

  // Clear Redis hold key if it was pending
  await clearHold(bookingId);

  // Notify live SSE clients watching this show
  notifyShowUpdated(booking.show_id);

  // Fetch updated booking with refreshed tickets & payment
  const fullBooking = await queries.getBookingById(bookingId);
  const tickets = await queries.getBookingTickets(null, bookingId);

  return {
    booking: {
      ...fullBooking,
      total_amount: parseFloat(fullBooking.total_amount),
      tickets,
    },
    message: 'Booking cancelled successfully. Payments (if any) have been refunded.',
  };
}

