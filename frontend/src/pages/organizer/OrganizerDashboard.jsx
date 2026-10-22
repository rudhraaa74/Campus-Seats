// ─────────────────────────────────────────────────────────────
// frontend/src/pages/organizer/OrganizerDashboard.jsx
// Club Manager Portal (Workflow W4 / Phase 5)
// Event management, show scheduling, venue price grids, and show cancellation
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import {
  Calendar,
  Clock,
  MapPin,
  PlusCircle,
  Settings,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Sparkles,
  DollarSign,
  Ban,
  Building2,
  Layers,
  BarChart3,
  Edit,
} from 'lucide-react';

export function OrganizerDashboard() {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('SHOWS'); // 'SHOWS' | 'EVENTS'

  // Modals state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [showShowModal, setShowShowModal] = useState(false);

  const [pricingShow, setPricingShow] = useState(null);
  const [pricingMatrix, setPricingMatrix] = useState({});

  const [cancellingShow, setCancellingShow] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form states
  const [eventForm, setEventForm] = useState({
    club_id: user?.clubIds?.[0] || 1,
    title: '',
    event_type: 'CULTURAL',
    duration_min: 120,
    description: '',
  });

  const [showForm, setShowForm] = useState({
    event_id: '',
    venue_id: '',
    start_time: '',
    end_time: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [eventsData, venuesData, showsData] = await Promise.all([
        api.get('/organizer/events'),
        api.get('/organizer/venues'),
        api.get('/shows'),
      ]);

      setEvents(eventsData.events || []);
      setVenues(venuesData.venues || []);
      setShows(showsData.shows || []);
    } catch (err) {
      setError(err.message || 'Failed to load organizer dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Event creation/updating handler
  const handleOpenEventModal = (eventToEdit = null) => {
    setModalError('');
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setEventForm({
        club_id: eventToEdit.club_id,
        title: eventToEdit.title,
        event_type: eventToEdit.event_type,
        duration_min: eventToEdit.duration_min,
        description: eventToEdit.description || '',
      });
    } else {
      setEditingEvent(null);
      setEventForm({
        club_id: user?.clubIds?.[0] || 1,
        title: '',
        event_type: 'CULTURAL',
        duration_min: 120,
        description: '',
      });
    }
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setModalError('');

      if (editingEvent) {
        await api.put(`/organizer/events/${editingEvent.event_id}`, eventForm);
        setSuccessMessage(`Event "${eventForm.title}" updated successfully.`);
      } else {
        await api.post('/organizer/events', eventForm);
        setSuccessMessage(`Event "${eventForm.title}" created successfully.`);
      }

      setShowEventModal(false);
      await fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to save event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Show scheduling handler
  const handleOpenShowModal = () => {
    setModalError('');
    setShowForm({
      event_id: events[0]?.event_id || '',
      venue_id: venues[0]?.venue_id || '',
      start_time: '',
      end_time: '',
    });
    setShowShowModal(true);
  };

  const handleSaveShow = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setModalError('');

      await api.post('/organizer/shows', {
        event_id: parseInt(showForm.event_id, 10),
        venue_id: parseInt(showForm.venue_id, 10),
        start_time: new Date(showForm.start_time).toISOString(),
        end_time: new Date(showForm.end_time).toISOString(),
      });

      setSuccessMessage('Show scheduled successfully.');
      setShowShowModal(false);
      await fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to schedule show.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Pricing Matrix handler
  const handleOpenPricingModal = (show) => {
    setModalError('');
    setPricingShow(show);

    const venue = venues.find((v) => v.venue_id === show.venue_id);
    const initialMatrix = {};

    (venue?.categories || []).forEach((cat) => {
      ['STUDENT', 'FACULTY', 'GUEST'].forEach((type) => {
        const key = `${cat.category_id}_${type}`;
        const existing = (show.prices || []).find(
          (p) => p.category_id === cat.category_id && p.user_type === type
        );
        initialMatrix[key] = existing ? existing.price : (type === 'STUDENT' ? 50 : type === 'FACULTY' ? 80 : 120);
      });
    });

    setPricingMatrix(initialMatrix);
  };

  const handleSavePrices = async (e) => {
    e.preventDefault();
    if (!pricingShow) return;

    try {
      setIsSubmitting(true);
      setModalError('');

      const priceList = Object.entries(pricingMatrix).map(([key, price]) => {
        const [categoryId, userType] = key.split('_');
        return {
          category_id: parseInt(categoryId, 10),
          user_type: userType,
          price: parseFloat(price),
        };
      });

      await api.put(`/organizer/shows/${pricingShow.show_id}/prices`, {
        prices: priceList,
      });

      setSuccessMessage(`Pricing updated for show #${pricingShow.show_id}.`);
      setPricingShow(null);
      await fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to update prices.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Show cancellation handler (BR10)
  const handleCancelShow = async () => {
    if (!cancellingShow) return;
    try {
      setIsSubmitting(true);
      setModalError('');

      const res = await api.post(`/organizer/shows/${cancellingShow.show_id}/cancel`);
      setSuccessMessage(res.message || `Show #${cancellingShow.show_id} cancelled. Attendee bookings refunded.`);
      setCancellingShow(null);
      await fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to cancel show.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Club Manager Portal
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-semibold">Rule BR11 Authorized</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Organizer Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create events, schedule shows with overlap protection (BR2), configure pricing matrices, and manage cancellations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/organizer/reports"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold shadow-xs transition-all"
          >
            <BarChart3 className="w-4 h-4 text-purple-700" />
            Analytics & Reports
          </Link>
          <button
            type="button"
            onClick={() => handleOpenEventModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4 text-purple-600" />
            New Event
          </button>
          <button
            type="button"
            onClick={handleOpenShowModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Calendar className="w-4 h-4" />
            Schedule Show
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm mb-6">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage('')} className="p-1 text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-900 border border-red-200 flex items-center justify-between gap-3 text-xs sm:text-sm mb-6">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="p-1 text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('SHOWS')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'SHOWS'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Scheduled Shows ({shows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('EVENTS')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'EVENTS'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Club Events ({events.length})
        </button>
      </div>

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-3" />
          <p className="text-sm font-medium">Loading organizer data...</p>
        </div>
      )}

      {/* TAB 1: SCHEDULED SHOWS */}
      {!loading && activeTab === 'SHOWS' && (
        <div className="space-y-4">
          {shows.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
              <Calendar className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Shows Scheduled</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Schedule your first show for your club events.</p>
              <button
                type="button"
                onClick={handleOpenShowModal}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm"
              >
                Schedule Show
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {shows.map((s) => {
                const isCancelled = s.status === 'CANCELLED';
                const startDate = new Date(s.start_time);
                const endDate = new Date(s.end_time);

                return (
                  <div
                    key={s.show_id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">#{s.show_id}</span>
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            CANCELLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            SCHEDULED
                          </span>
                        )}
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-500">{s.event_title}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          {startDate.toLocaleDateString()} · {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-600" />
                          {s.venue_name} ({s.venue_type?.toUpperCase()})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenPricingModal(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        Price Grid
                      </button>

                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => setCancellingShow(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold transition-all"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancel Show
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLUB EVENTS */}
      {!loading && activeTab === 'EVENTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e) => (
              <div
                key={e.event_id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {e.event_type}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">#{e.event_id}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{e.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {e.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {e.duration_min} min
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEventModal(e)}
                    className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: EVENT FORM MODAL ─── */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingEvent ? 'Edit Club Event' : 'Create New Club Event'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g. Battle of the Bands 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Type</label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="CULTURAL">CULTURAL</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                    <option value="SPORTS">SPORTS</option>
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    min="15"
                    required
                    value={eventForm.duration_min}
                    onChange={(e) => setEventForm({ ...eventForm, duration_min: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Provide an overview of the event..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SCHEDULE SHOW MODAL ─── */}
      {showShowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Schedule Show</h3>
              <button
                type="button"
                onClick={() => setShowShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveShow} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Event</label>
                <select
                  required
                  value={showForm.event_id}
                  onChange={(e) => setShowForm({ ...showForm, event_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {events.map((ev) => (
                    <option key={ev.event_id} value={ev.event_id}>
                      {ev.title} ({ev.duration_min} min required)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campus Venue</label>
                <select
                  required
                  value={showForm.venue_id}
                  onChange={(e) => setShowForm({ ...showForm, venue_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {venues.map((v) => (
                    <option key={v.venue_id} value={v.venue_id}>
                      {v.name} ({v.venue_type.toUpperCase()} · Capacity: {v.capacity || '500'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={showForm.start_time}
                    onChange={(e) => setShowForm({ ...showForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={showForm.end_time}
                    onChange={(e) => setShowForm({ ...showForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200/60 text-[11px] text-purple-900 space-y-1">
                <div>• Overlap check: PostgreSQL exclusion constraint (BR2) enforces single booking per venue.</div>
                <div>• Duration check: Show duration must be at least as long as event duration (BR13).</div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Schedule Show
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: PRICE GRID MODAL ─── */}
      {pricingShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Price Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Show #{pricingShow.show_id} · {pricingShow.event_title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPricingShow(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePrices} className="mt-4 space-y-4">
              <div className="space-y-4">
                {(venues.find((v) => v.venue_id === pricingShow.venue_id)?.categories || []).map((cat) => (
                  <div key={cat.category_id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="font-bold text-xs text-slate-900 block mb-2">{cat.name} Tier</span>
                    <div className="grid grid-cols-3 gap-2">
                      {['STUDENT', 'FACULTY', 'GUEST'].map((tier) => {
                        const key = `${cat.category_id}_${tier}`;
                        return (
                          <div key={tier}>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              {tier} (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="5"
                              required
                              value={pricingMatrix[key] || ''}
                              onChange={(e) =>
                                setPricingMatrix({
                                  ...pricingMatrix,
                                  [key]: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPricingShow(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Price Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: CANCEL SHOW CONFIRMATION MODAL (BR10) ─── */}
      {cancellingShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Cancel Show?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to cancel show #{cancellingShow.show_id} for{' '}
                <span className="font-semibold text-slate-800">{cancellingShow.event_title}</span>?
              </p>
            </div>

            <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200/80 text-xs text-red-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Automatic Cascade (Rule BR10):
              </div>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Cancelling this show will automatically cancel all attendee bookings, release tickets, and refund successful payments.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCancellingShow(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Keep Show
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancelShow}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-red-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel Show'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
