// ─────────────────────────────────────────────────────────────
// frontend/src/pages/ShowDetail.jsx
// Show details page with pricing matrix and live polling seat map
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PriceTable } from '../components/PriceTable.jsx';
import { SeatMap } from '../components/SeatMap.jsx';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export function ShowDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [show, setShow] = useState(null);
  const [seatData, setSeatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Fetch show details
  useEffect(() => {
    let isMounted = true;
    async function fetchShow() {
      try {
        setLoading(true);
        setError('');
        const data = await api.get(`/shows/${id}`);
        if (isMounted) {
          setShow(data.show);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load show details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchShow();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetch live seat status
  const fetchSeats = useCallback(async () => {
    try {
      setIsPolling(true);
      const data = await api.get(`/shows/${id}/seats`);
      setSeatData(data);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Seat availability polling failed:', err);
    } finally {
      setTimeout(() => setIsPolling(false), 600);
    }
  }, [id]);

  // Initial seat fetch and polling interval (every 4 seconds)
  useEffect(() => {
    fetchSeats();
    const interval = setInterval(() => {
      fetchSeats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchSeats]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading show and seat availability...</p>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900">Show Unavailable</h3>
            <p className="text-sm mt-1">{error || 'Show details could not be retrieved.'}</p>
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

  const startDate = new Date(show.start_time);
  const endDate = new Date(show.end_time);

  const formattedDate = startDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedStartTime = startDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const formattedEndTime = endDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Events
        </Link>
      </div>

      {/* Show Overview Hero Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {show.event?.event_type || 'EVENT'}
              </span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                Organized by {show.club?.club_name}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {show.event?.title}
            </h1>

            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed pt-1">
              {show.event?.description}
            </p>
          </div>

          <div className="text-right flex flex-col items-end">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                show.status === 'SCHEDULED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {show.status}
            </span>
            {lastSyncTime && (
              <span className="text-[11px] text-slate-400 mt-2">
                Seats updated: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Show Metadata Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Date</div>
              <div className="text-sm font-bold text-slate-900">{formattedDate}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Show Time</div>
              <div className="text-sm font-bold text-slate-900">
                {formattedStartTime} – {formattedEndTime}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Venue</div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {show.venue?.name || show.venue?.venue_name}
                <span className="text-[10px] font-semibold uppercase text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded">
                  {show.venue?.venue_type}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Seat Map and Price Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Seat Map (spans 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <SeatMap
            showId={show.show_id}
            venueType={seatData?.venue_type || show.venue?.venue_type}
            venueName={show.venue?.name || show.venue?.venue_name}
            seats={seatData?.seats || []}
            classroomData={seatData}
            prices={show.prices || []}
            isPolling={isPolling}
            lastUpdated={lastSyncTime}
            onRefresh={fetchSeats}
          />
        </div>

        {/* Right Column: Pricing Matrix & Booking Info */}
        <div className="space-y-6">
          <PriceTable prices={show.prices} userType={user?.user_type} />

          <div className="bg-emerald-950 text-white p-6 rounded-2xl shadow-sm space-y-3 border border-emerald-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-sm">5-Minute Seat Hold Guarantee</h4>
            </div>
            <p className="text-xs text-emerald-200 leading-relaxed">
              When you select seats and click to hold, they are locked in PostgreSQL for 5 minutes. No other attendee can book your seats while your timer runs.
            </p>
            <div className="pt-2 border-t border-emerald-800/80 text-[11px] text-emerald-300 space-y-1">
              <div>• Max 6 tickets per booking (Rule BR6)</div>
              <div>• Student & Faculty rates apply to all tickets booked under your account</div>
              <div>• Real-time concurrency protection via partial unique indexes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
