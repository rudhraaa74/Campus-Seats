// ─────────────────────────────────────────────────────────────
// frontend/src/pages/Checkout.jsx
// Checkout page with live countdown timer, payment simulation, and e-tickets
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CountdownTimer } from '../components/CountdownTimer.jsx';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Ticket,
  Printer,
} from 'lucide-react';

export function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [paying, setPaying] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState(null);

  // Fetch booking details
  useEffect(() => {
    let isMounted = true;
    async function loadBooking() {
      try {
        setLoading(true);
        setError('');
        const data = await api.get(`/bookings/${id}`);
        if (isMounted) {
          setBooking(data.booking);
          // Check if already confirmed
          if (data.booking.status === 'CONFIRMED' && data.booking.payment_id) {
            setConfirmedPayment({
              payment_id: data.booking.payment_id,
              amount: data.booking.paid_amount,
              payment_method: data.booking.payment_method,
              gateway_ref: data.booking.gateway_ref,
              paid_at: data.booking.paid_at,
            });
          }
          // Check if already expired
          if (new Date() > new Date(data.booking.hold_expires_at) && data.booking.status === 'PENDING') {
            setIsExpired(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load booking details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadBooking();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleHoldExpired = () => {
    setIsExpired(true);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (isExpired || paying) return;

    try {
      setPaying(true);
      setError('');
      const res = await api.post(`/bookings/${id}/pay`, {
        payment_method: paymentMethod,
        simulate_failure: simulateFailure,
      });

      // Preserve previously loaded show & venue metadata and tickets
      const updatedBooking = {
        ...(booking || {}),
        ...res.booking,
      };
      if (!res.booking?.tickets && booking?.tickets) {
        updatedBooking.tickets = booking.tickets;
      }

      setBooking(updatedBooking);
      setConfirmedPayment(
        res.booking.payment || {
          payment_id: res.booking.payment_id,
          amount: res.booking.paid_amount || res.booking.total_amount,
          payment_method: res.booking.payment_method || paymentMethod,
          gateway_ref: res.booking.gateway_ref,
          paid_at: res.booking.paid_at || new Date().toISOString(),
        }
      );
    } catch (err) {
      if (err.code === 'HOLD_EXPIRED') {
        setIsExpired(true);
      }
      setError(err.message || 'Payment processing failed.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading your held seats and checkout session...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900">Checkout Error</h3>
            <p className="text-sm mt-1">{error}</p>
            <Link
              to="/events"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Events Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success State: E-Ticket Screen
  if (confirmedPayment) {
    const startDate = booking.start_time ? new Date(booking.start_time) : null;
    const formattedDate = startDate ? startDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) : '';

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Celebratory Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Booking Confirmed!</h1>
            <p className="text-emerald-100 text-sm mt-1.5">
              Your tickets are confirmed and seats have been marked as ACTIVE.
            </p>
          </div>

          {/* Ticket Information Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event & Show</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{booking.event_title}</h2>
                <p className="text-xs text-slate-500 mt-1">Organized by {booking.club_name}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Booking ID</span>
                <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">#{booking.booking_id}</div>
                <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-1">
                  CONFIRMED
                </span>
              </div>
            </div>

            {/* Venue & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700 font-medium">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-purple-600" />
                <span className="text-slate-700 font-medium">
                  {booking.venue_name} ({booking.venue_type?.toUpperCase()})
                </span>
              </div>
            </div>

            {/* Confirmed Tickets List */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-emerald-600" />
                Your Issued E-Tickets ({booking.tickets?.length || 0})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {booking.tickets?.map((t) => (
                  <div
                    key={t.ticket_id}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {t.row_label ? `Seat ${t.row_label}-${t.seat_no || t.seat_number}` : 'General Admission Pass'}
                      </div>
                      <div className="text-xs text-slate-500">
                        Tier: {t.attendee_type} • ₹{t.price || t.price_paid}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                <span>Paid via <strong>{confirmedPayment.payment_method}</strong></span>
                <span className="mx-2">•</span>
                <span>Ref: <code className="font-mono">{confirmedPayment.gateway_ref}</code></span>
              </div>
              <div className="text-base font-extrabold text-slate-900">
                Total Paid: ₹{confirmedPayment.amount}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
              <Link
                to="/events"
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Browse More Events
              </Link>
              <Link
                to={`/bookings/${booking.booking_id}/ticket`}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print E-Ticket (with QR)
              </Link>
              <Link
                to="/my-bookings"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                View in My Bookings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expired State
  if (isExpired) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Hold Timer Expired</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            The 5-minute reservation timer for Booking #{booking.booking_id} has lapsed. As per campus rules, the held seats have been automatically released for other attendees.
          </p>
          <div className="pt-4">
            <Link
              to={`/shows/${booking.show_id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Seat Map & Pick Seats Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Hold & Payment Form State
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Link
          to={`/shows/${booking.show_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Seat Map
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Order Summary & Held Tickets (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Order & Seat Summary</h1>
              <p className="text-xs text-slate-500 mt-0.5">Booking Reference #{booking.booking_id}</p>
            </div>

            {/* Countdown Timer synced with server hold_expires_at */}
            <CountdownTimer
              expiresAt={booking.hold_expires_at}
              onExpired={handleHoldExpired}
            />
          </div>

          {/* Show Details Card */}
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">{booking.event_title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                {booking.venue_name}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Held Seats List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Reserved Seats ({booking.tickets?.length || 0})
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
              {booking.tickets?.map((t) => (
                <div key={t.ticket_id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="font-bold text-slate-900">
                      {t.row_label ? `Row ${t.row_label}, Seat ${t.seat_no || t.seat_number}` : 'Classroom Entry Pass'}
                    </span>
                    <span className="text-slate-400 text-[11px]">({t.attendee_type})</span>
                  </div>
                  <div className="font-bold text-slate-900">₹{t.price || t.price_paid}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Due */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Total Amount Due</span>
            <span className="text-2xl font-extrabold text-slate-900">₹{booking.total_amount}</span>
          </div>
        </div>

        {/* Right Column: Simulated Payment Form (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Payment Gateway
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select payment method to complete your reservation.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePay} className="space-y-4">
            {/* Payment Method Radio options */}
            <div className="space-y-2">
              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="method"
                    value="UPI"
                    checked={paymentMethod === 'UPI'}
                    onChange={() => setPaymentMethod('UPI')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>UPI (Google Pay / PhonePe / Paytm)</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-semibold">Fast</span>
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="method"
                    value="CREDIT_CARD"
                    checked={paymentMethod === 'CREDIT_CARD'}
                    onChange={() => setPaymentMethod('CREDIT_CARD')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Credit / Debit Card</span>
                </div>
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'SIMULATED'
                    ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 font-bold shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="method"
                    value="SIMULATED"
                    checked={paymentMethod === 'SIMULATED'}
                    onChange={() => setPaymentMethod('SIMULATED')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Instant Demo Sandbox Gateway</span>
                </div>
              </label>
            </div>

            {/* Test Checkbox: Simulate Gateway Failure */}
            <div className="pt-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer p-2 bg-slate-50 rounded-lg border border-slate-200/60">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>Simulate Gateway Failure (Test error logging & retry)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={paying || isExpired}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Pay ₹{booking.total_amount} Now
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Simulated campus payment sandbox • No real money charged</span>
          </div>
        </div>
      </div>
    </div>
  );
}
