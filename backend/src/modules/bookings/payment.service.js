// ─────────────────────────────────────────────────────────────
// backend/src/modules/bookings/payment.service.js
// Gateway order creation, HMAC signature verification & payment settlement
// ─────────────────────────────────────────────────────────────

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { withTransaction } from '../../db/transaction.js';
import * as queries from './bookings.queries.js';
import { clearHold } from '../../redis/holds.js';
import { notifyShowUpdated } from '../../events/seatEvents.js';
import { sendBookingConfirmationEmail } from '../../utils/mailer.js';
import { getBookingDetail } from './bookings.service.js';

let razorpayInstance = null;

function getRazorpay() {
  if (!razorpayInstance && env.razorpay.enabled) {
    razorpayInstance = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Creates a payment gateway order for a held booking.
 * Returns order details and public key for the frontend checkout modal.
 */
export async function createPaymentOrder(bookingId, userId) {
  const booking = await queries.getBookingById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (booking.user_id !== userId) {
    const error = new Error('You do not have permission to pay for this booking.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (booking.status === 'CONFIRMED') {
    return {
      alreadyConfirmed: true,
      booking_id: booking.booking_id,
      status: 'CONFIRMED',
      message: 'This booking is already paid and confirmed.',
    };
  }

  if (booking.status !== 'PENDING') {
    const error = new Error(`Booking cannot be paid (current status: ${booking.status}).`);
    error.status = 400;
    error.code = 'INVALID_STATE';
    throw error;
  }

  const holdExpiresAt = new Date(booking.hold_expires_at).getTime();
  if (holdExpiresAt <= Date.now()) {
    const error = new Error('Your seat hold has expired. Please select your seats again.');
    error.status = 422;
    error.code = 'HOLD_EXPIRED';
    throw error;
  }

  const amountPaise = Math.round(parseFloat(booking.total_amount) * 100);

  // If Razorpay credentials exist in env, create a real order with Razorpay
  if (env.razorpay.enabled) {
    try {
      const rzp = getRazorpay();
      const order = await rzp.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `SS_BK_${bookingId}`,
        notes: {
          booking_id: String(bookingId),
          show_id: String(booking.show_id),
          event_title: booking.event_title || '',
          user_id: String(userId),
        },
      });

      return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: env.razorpay.keyId,
        simulated: false,
        booking: {
          booking_id: booking.booking_id,
          event_title: booking.event_title,
          club_name: booking.club_name,
          venue_name: booking.venue_name,
          start_time: booking.start_time,
          total_amount: parseFloat(booking.total_amount),
          first_name: booking.first_name,
          last_name: booking.last_name,
          email: booking.email,
          phone: booking.phone,
        },
      };
    } catch (err) {
      console.warn(`[Razorpay Warning] Order creation failed: ${err.message}. Falling back to simulator.`);
    }
  }

  // Fallback: Simulated order for local development / testing without API keys
  return {
    order_id: `order_sim_${bookingId}_${Date.now()}`,
    amount: amountPaise,
    currency: 'INR',
    key_id: 'rzp_test_simulated',
    simulated: true,
    booking: {
      booking_id: booking.booking_id,
      event_title: booking.event_title,
      club_name: booking.club_name,
      venue_name: booking.venue_name,
      start_time: booking.start_time,
      total_amount: parseFloat(booking.total_amount),
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      phone: booking.phone,
    },
  };
}

/**
 * Verifies Razorpay HMAC signature (or simulated payment) and settles the booking
 */
export async function verifyAndConfirmPayment(bookingId, userId, payload = {}) {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_method = 'UPI',
    simulate_failure = false,
  } = payload;

  if (simulate_failure) {
    const error = new Error('Payment was declined by the bank or simulator.');
    error.status = 422;
    error.code = 'PAYMENT_FAILED';
    throw error;
  }

  const isSimulated = !razorpay_order_id || razorpay_order_id.startsWith('order_sim_') || !env.razorpay.enabled;

  // Real Razorpay signature verification
  if (!isSimulated && env.razorpay.enabled) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const error = new Error('Missing payment verification details.');
      error.status = 422;
      error.code = 'PAYMENT_VERIFICATION_FAILED';
      throw error;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const signatureBuffer = Buffer.from(razorpay_signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      const error = new Error('Payment signature verification failed. Untrusted transaction.');
      error.status = 422;
      error.code = 'PAYMENT_VERIFICATION_FAILED';
      throw error;
    }
  }

  // Atomically lock and confirm booking in PostgreSQL
  const result = await withTransaction(async (client) => {
    const booking = await queries.lockBookingForUpdate(client, bookingId);
    if (!booking) {
      const error = new Error('Booking not found.');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (booking.user_id !== userId) {
      const error = new Error('You do not have permission to pay for this booking.');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Idempotency: return existing successful payment if already confirmed
    if (booking.status === 'CONFIRMED') {
      const existingPayment = await queries.getSuccessfulPaymentByBookingId(client, bookingId);
      return { booking, payment: existingPayment, alreadyConfirmed: true };
    }

    if (booking.status !== 'PENDING') {
      const error = new Error(`Booking cannot be confirmed (current status: ${booking.status}).`);
      error.status = 400;
      error.code = 'INVALID_STATE';
      throw error;
    }

    const holdExpiresAt = new Date(booking.hold_expires_at).getTime();
    if (holdExpiresAt <= Date.now()) {
      const error = new Error('Payment hold has expired. Your seats have been released.');
      error.status = 422;
      error.code = 'HOLD_EXPIRED';
      throw error;
    }

    // Map payment method to PostgreSQL CHECK constraint values
    let normalizedMethod = (payment_method || 'UPI').toUpperCase();
    if (normalizedMethod === 'CARD') normalizedMethod = 'CREDIT_CARD';
    if (normalizedMethod === 'NETBANKING') normalizedMethod = 'NET_BANKING';
    if (!['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'SIMULATED'].includes(normalizedMethod)) {
      normalizedMethod = 'UPI';
    }

    const gatewayRef =
      razorpay_payment_id ||
      `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Record payment row
    const payment = await queries.recordPayment(client, {
      bookingId,
      amount: booking.total_amount,
      paymentMethod: normalizedMethod,
      gatewayRef,
      status: 'SUCCESS',
    });

    // Update booking status to CONFIRMED
    const updatedBooking = await queries.confirmBooking(client, bookingId);

    // Activate tickets from HELD to ACTIVE
    await queries.activateTickets(client, bookingId);

    return { booking: updatedBooking, payment };
  });

  // Clear Redis hold key now that booking is confirmed
  await clearHold(bookingId);

  // Notify live SSE clients watching this show
  notifyShowUpdated(result.booking.show_id);

  // Retrieve complete detailed booking (event, show, venue, tickets)
  const detailed = await getBookingDetail(bookingId, userId);

  // Automatically send booking confirmation email with PDF tickets & invoice asynchronously
  sendBookingConfirmationEmail(
    detailed.booking.email,
    detailed.booking,
    detailed.booking.tickets
  ).catch((err) => {
    console.warn('[Mailer Warning] Async booking confirmation email failed:', err.message);
  });

  return {
    success: true,
    booking: {
      ...detailed.booking,
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
