// ─────────────────────────────────────────────────────────────
// frontend/src/pages/organizer/ReportsDashboard.jsx
// Interactive analytical dashboard showcasing non-trivial reporting (Phase 6 / W5)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import {
  BarChart3,
  TrendingUp,
  Users,
  Ticket,
  Calendar,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  Filter,
  CheckCircle2,
  Award,
  Layers,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { OccupancyChart, RevenueBreakdownChart, TopEventsRankingTable } from '../../components/ReportCharts.jsx';

export function ReportsDashboard() {
  const { user } = useAuth();

  const isClubManager = Boolean(
    user && (
      (Array.isArray(user.clubIds) && user.clubIds.length > 0) ||
      (Array.isArray(user.clubs) && user.clubs.length > 0)
    )
  );

  // If not a club manager, immediately redirect to /events without showing anything
  if (!isClubManager) {
    return <Navigate to="/events" replace />;
  }

  const [activeTab, setActiveTab] = useState('occupancy');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedEventId, setSelectedEventId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventsList, setEventsList] = useState([]);

  // Report data state
  const [summary, setSummary] = useState(null);
  const [occupancy, setOccupancy] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [unsoldShows, setUnsoldShows] = useState([]);
  const [activeAttendees, setActiveAttendees] = useState([]);
  const [rowUtilization, setRowUtilization] = useState([]);

  // Load event list for the filter dropdown
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await api.get('/organizer/events');
        setEventsList(data.events || []);
      } catch (err) {
        console.warn('Could not load events list for filters:', err.message);
      }
    }
    loadEvents();
  }, []);

  // Fetch report data
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedEventId) queryParams.append('eventId', selectedEventId);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const [sumRes, occRes, revRes, topRes, unsoldRes, attRes, rowRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get(`/reports/occupancy${qs}`),
        api.get(`/reports/revenue${selectedEventId ? `?eventId=${selectedEventId}` : ''}`),
        api.get('/reports/top-events'),
        api.get('/reports/unsold-shows'),
        api.get('/reports/active-attendees?minBookings=1'),
        api.get('/reports/row-utilization'),
      ]);

      setSummary(sumRes.summary || null);
      setOccupancy(occRes.occupancy || []);
      setRevenue(revRes.revenue || []);
      setTopEvents(topRes.topEvents || []);
      setUnsoldShows(unsoldRes.unsoldShows || []);
      setActiveAttendees(attRes.activeAttendees || []);
      setRowUtilization(rowRes.rowUtilization || []);
    } catch (err) {
      setError(err.message || 'Failed to load reporting data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedEventId, dateFrom, dateTo]);

  const tabs = [
    { id: 'occupancy', label: '1. Show Occupancy', icon: BarChart3, desc: 'Live demand vs capacity' },
    { id: 'revenue', label: '2. Revenue by Tier', icon: IndianRupee, desc: 'Student / Faculty / Guest' },
    { id: 'top-events', label: '3. Top Events', icon: Award, desc: 'DENSE_RANK revenue leaderboard' },
    { id: 'unsold', label: '4. Shows With Seats', icon: Layers, desc: 'NOT EXISTS live tickets' },
    { id: 'attendees', label: '5. Active Attendees', icon: UserCheck, desc: 'GROUP BY + HAVING' },
    { id: 'rows', label: '6. Row Heatmap', icon: Ticket, desc: 'Auditorium fill rate' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              Club Manager Analytics
            </span>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Managing: {user?.clubs?.map((c) => c.club_name || `Club #${c.club_id}`).join(', ') || 'Music Club'}
            </span>
            <span className="text-xs text-slate-500">• Workflow W5</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Performance Analytics & Course Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time PostgreSQL aggregate metrics, window functions, and multi-table analytical queries for <strong>{user?.clubs?.map((c) => c.club_name).join(', ') || 'Music Club'}</strong>.
          </p>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800 font-medium">{error}</div>
        </div>
      )}

      {/* Club Data Scope Note */}
      <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            <strong>DBMS Scope:</strong> Metrics reflect events organized by <strong>{user?.clubs?.map((c) => c.club_name).join(', ') || 'Music Club'}</strong>. Bookings and ticket revenue for events of other clubs (e.g. Drama Society, Literary Society) are isolated to their respective club manager accounts per Rule BR11.
          </span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{summary ? Number(summary.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Confirmed ticket payments</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Tickets</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary ? summary.confirmed_tickets : 0}
          </div>
          <div className="text-xs text-blue-600 font-medium mt-1">
            + {summary ? summary.held_tickets : 0} currently held
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Fill Rate</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary ? `${summary.avg_occupancy_pct}%` : '0%'}
          </div>
          <div className="text-xs text-purple-600 font-medium mt-1">Across all scheduled shows</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Scheduled Shows</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary ? summary.total_shows : 0}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1">
            Across {summary ? summary.total_events : 0} productions
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
          <Filter className="w-4 h-4 text-purple-600" />
          <span>Filters:</span>
        </div>

        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Club Events & Shows</option>
            {eventsList.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.title} ({ev.event_type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {(selectedEventId || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSelectedEventId('');
              setDateFrom('');
              setDateTo('');
            }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mt-6 overflow-x-auto space-x-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                isActive
                  ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
              <div>
                <div>{tab.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-xs text-slate-500 mt-3 font-medium">Computing PostgreSQL analytical aggregations...</p>
          </div>
        ) : (
          <div>
            {/* TAB 1: Show Occupancy */}
            {activeTab === 'occupancy' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 1):</span> Multi-table JOINs, GROUP BY, and dynamic capacity resolution via view <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">v_venue_capacity</code>.
                  </div>
                </div>
                <OccupancyChart data={occupancy} />
              </div>
            )}

            {/* TAB 2: Revenue Breakdown */}
            {activeTab === 'revenue' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 2):</span> Common Table Expression (<code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">WITH ticket_breakdown AS</code>) + Multi-level conditional aggregations.
                  </div>
                </div>
                <RevenueBreakdownChart data={revenue} />
              </div>
            )}

            {/* TAB 3: Top Events Ranking */}
            {activeTab === 'top-events' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 3):</span> Window Function <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">DENSE_RANK() OVER (ORDER BY total_revenue DESC)</code> for competitive leaderboards.
                  </div>
                </div>
                <TopEventsRankingTable data={topEvents} />
              </div>
            )}

            {/* TAB 4: Shows With Seats Free / No Live Tickets */}
            {activeTab === 'unsold' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 4):</span> Correlated Subquery with <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">NOT EXISTS (SELECT 1 FROM ticket WHERE ...)</code> to surface unsold upcoming shows.
                  </div>
                </div>

                {unsoldShows.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-sm text-slate-500">
                    All scheduled shows currently have active bookings!
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 font-bold text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Show ID</th>
                          <th className="px-4 py-3">Event Title</th>
                          <th className="px-4 py-3">Venue</th>
                          <th className="px-4 py-3">Start Time</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unsoldShows.map((s) => (
                          <tr key={s.show_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">#{s.show_id}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{s.event_title}</td>
                            <td className="px-4 py-3 text-slate-600">{s.venue_name} ({s.venue_type})</td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(s.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                0 Tickets Sold
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Active Attendees */}
            {activeTab === 'attendees' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 5):</span> Aggregate Filtering with <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">GROUP BY ... HAVING COUNT(b.booking_id) &gt;= N</code> to identify VIP campus attendees.
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Attendee</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Total Bookings</th>
                        <th className="px-4 py-3">Confirmed</th>
                        <th className="px-4 py-3">Cancelled</th>
                        <th className="px-4 py-3 text-right">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeAttendees.map((att) => (
                        <tr key={att.user_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{att.first_name} {att.last_name || ''}</div>
                            <div className="text-[11px] text-slate-500">{att.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                              {att.user_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">{att.total_bookings}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">{att.confirmed_bookings}</td>
                          <td className="px-4 py-3 text-slate-400">{att.cancelled_bookings}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                            ₹{Number(att.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: Row Heatmap */}
            {activeTab === 'rows' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100">
                  <div className="text-xs text-purple-900">
                    <span className="font-bold">SQL Technique (Query 6):</span> Row-level demand aggregation and fill-rate % across Main Auditorium tiers.
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Venue</th>
                        <th className="px-4 py-3">Tier Category</th>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Total Seats</th>
                        <th className="px-4 py-3">Active Tickets Sold</th>
                        <th className="px-4 py-3 text-right">Row Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rowUtilization.map((r, idx) => {
                        const fill = parseFloat(r.row_fill_rate_pct || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{r.venue_name}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                r.category_name === 'Gold' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.category_name}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-900">Row {r.row_label}</td>
                            <td className="px-4 py-2.5 text-slate-600">{r.total_seats_in_row}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800">{r.tickets_sold}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-purple-700">
                              {fill.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
