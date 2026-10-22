// ─────────────────────────────────────────────────────────────
// frontend/src/pages/Events.jsx
// Event catalog with search, category pills, club filters, and show links
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Search,
  Calendar,
  Clock,
  Sparkles,
  Tag,
  Users,
  ChevronRight,
  Filter,
  RotateCcw,
  Loader2,
} from 'lucide-react';

const CATEGORIES = ['ALL', 'CULTURAL', 'TECHNICAL', 'SPORTS', 'ACADEMIC', 'OTHER'];

export function Events() {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedClub, setSelectedClub] = useState('');
  const [selectedSort, setSelectedSort] = useState('date_asc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Fetch filter options (clubs) on initial mount
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const res = await api.get('/events/filters');
        if (res.clubs) setClubs(res.clubs);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadFilterOptions();
  }, []);

  // Fetch events whenever filters change
  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('q', searchQuery.trim());
        if (selectedType !== 'ALL') params.append('type', selectedType);
        if (selectedClub) params.append('club_id', selectedClub);
        if (selectedSort) params.append('sort', selectedSort);
        params.append('page', page);
        params.append('limit', 12);

        const data = await api.get(`/events?${params.toString()}`);
        if (isMounted) {
          setEvents(data.events || []);
          setPagination(data.pagination || { total: 0, totalPages: 1 });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load events.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const timeout = setTimeout(() => {
      loadEvents();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchQuery, selectedType, selectedClub, selectedSort, page]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedClub('');
    setSelectedSort('date_asc');
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome & Announcement Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl mb-10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-semibold backdrop-blur-sm mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            Phase 3: Live Event Browsing & Real-Time Seat Availability
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Campus Venue & Event Booking
          </h1>
          <p className="mt-3 text-emerald-100 text-sm sm:text-base leading-relaxed">
            Discover upcoming concerts, theatre productions, and academic lectures.
            {user ? (
              <>
                {' '}Logged in as <span className="font-bold text-white uppercase">{user.first_name} ({user.user_type})</span>.
              </>
            ) : (
              ' Sign in to unlock your student or faculty ticket privileges.'
            )}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search events by title or keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Club Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedClub}
              onChange={(e) => {
                setSelectedClub(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Clubs & Societies</option>
              {clubs.map((c) => (
                <option key={c.club_id} value={c.club_id}>
                  {c.club_name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="date_asc">Show Date (Earliest First)</option>
              <option value="date_desc">Show Date (Latest First)</option>
              <option value="title">Event Title (A to Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Category:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedType(cat);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  selectedType === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {(searchQuery || selectedType !== 'ALL' || selectedClub) && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm font-medium">Loading campus events...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No events matched your filters</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Try adjusting your search terms or clearing your category filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => {
            const nextShowDate = ev.next_show_at ? new Date(ev.next_show_at) : null;
            const formattedShowTime = nextShowDate
              ? nextShowDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'No upcoming shows';

            return (
              <div
                key={ev.event_id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="p-6">
                  {/* Category & Club header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {ev.type || ev.event_type}
                    </span>
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {ev.club_name}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug line-clamp-1">
                    {ev.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {ev.description || 'No description provided.'}
                  </p>

                  {/* Show Information */}
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>Next Show: <strong className="text-slate-800">{formattedShowTime}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span>Duration: {ev.duration_min} minutes</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {ev.shows_count} {ev.shows_count === 1 ? 'Show' : 'Shows'}
                  </span>
                  <Link
                    to={`/shows/${ev.event_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    View Shows & Seats
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                page === p
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
