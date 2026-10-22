// ─────────────────────────────────────────────────────────────
// frontend/src/pages/MyBookings.jsx
// Attendee booking history with status badges, e-ticket view & resume checkout
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';

export function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'CONFIRMED' | 'PENDING' | 'PAST'

  useEffect(() => {
    let isMounted = true;
    async function fetchBookings() {
      try {
        setLoading(true);
        setError('');
        const data = await api.get('/bookings/mine');
        if (isMounted) {
          setBookings(data.bookings || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load your booking history.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchBookings();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'ALL') return true;
    if (filter === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (filter === 'PENDING') return b.status === 'PENDING';
    if (filter === 'PAST') return b.status === 'EXPIRED' || b.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Ticket className="w-7 h-7 text-emerald-600" />
            My Bookings & E-Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your reservations, view active tickets, or complete pending checkouts.
          </p>
        </div>

        <Link
          to="/events"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Browse More Shows
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Bookings ({bookings.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('CONFIRMED')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            filter === 'CONFIRMED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirmed ({bookings.filter((b) => b.status === 'CONFIRMED').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            filter === 'PENDING'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock3 className="w-3.5 h-3.5" />
          Pending Hold ({bookings.filter((b) => b.status === 'PENDING').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('PAST')}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            filter === 'PAST'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Past / Expired ({bookings.filter((b) => b.status === 'EXPIRED' || b.status === 'CANCELLED').length})
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm font-medium">Loading your bookings...</p>
        </div>
      )}

      {error && (
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredBookings.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm my-8">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <Ticket className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Bookings Found</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            {filter === 'ALL'
              ? 'You have not reserved or purchased any show tickets yet. Check out upcoming campus events!'
              : `No bookings matching the "${filter}" filter.`}
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            Explore Events Catalog
          </Link>
        </div>
      )}

      {/* Bookings List */}
      {!loading && !error && filteredBookings.length > 0 && (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const startDate = b.start_time ? new Date(b.start_time) : null;
            const formattedDate = startDate
              ? startDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'TBD';

            const formattedTime = startDate
              ? startDate.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '';

            const isPending = b.status === 'PENDING';
            const isConfirmed = b.status === 'CONFIRMED';
            const isExpired = b.status === 'EXPIRED';
            const isCancelled = b.status === 'CANCELLED';

            return (
              <div
                key={b.booking_id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left: Event & Show Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{b.booking_id}
                    </span>
                    {/* Status Badge */}
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        CONFIRMED
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <Clock3 className="w-3 h-3" />
                        ON HOLD (PENDING)
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        <XCircle className="w-3 h-3" />
                        EXPIRED
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <XCircle className="w-3 h-3" />
                        CANCELLED
                      </span>
                    )}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Organized by {b.club_name}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{b.event_title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      {formattedDate} at {formattedTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-600" />
                      {b.venue_name} ({b.venue_type?.toUpperCase()})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-blue-600" />
                      {b.ticket_count || 1} {b.ticket_count === 1 ? 'Ticket' : 'Tickets'}
                    </span>
                  </div>
                </div>

                {/* Right: Price & Action CTA */}
                <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {isConfirmed ? 'Amount Paid' : 'Amount Due'}
                    </span>
                    <div className="text-xl font-extrabold text-slate-900">
                      ₹{b.total_amount}
                    </div>
                  </div>

                  <div>
                    {isConfirmed && (
                      <Link
                        to={`/checkout/${b.booking_id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        View E-Ticket
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    {isPending && (
                      <Link
                        to={`/checkout/${b.booking_id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        Complete Payment
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    {(isExpired || isCancelled) && (
                      <Link
                        to={`/shows/${b.show_id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all"
                      >
                        Book Again
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
