// ─────────────────────────────────────────────────────────────
// frontend/src/components/SeatMap.jsx
// Clean White 500-Seat Straight Auditorium & Classroom Selection Map
// Interactive seat selection (up to 6 tickets), attendee tier selection,
// dynamic price calculation, 5-minute hold creation, and live polling.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import {
  Users,
  Info,
  RefreshCw,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  AlertCircle,
  Loader2,
  Ticket,
} from 'lucide-react';

export function SeatMap({
  showId,
  venueType = 'auditorium',
  venueName = '',
  seats = [],
  classroomData = null,
  prices = [],
  isPolling = false,
  lastUpdated = null,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tierFilter, setTierFilter] = useState('ALL'); // 'ALL' | 'GOLD' | 'SILVER'
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 (fit), 1.25, 1.5, 2.0
  const [selectedSeats, setSelectedSeats] = useState([]); // [{ row_label, seat_no, category_name, attendee_type }]
  const [selectionError, setSelectionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Classroom state
  const [classroomQty, setClassroomQty] = useState(1);
  const [classroomAttendeeType, setClassroomAttendeeType] = useState(
    user?.user_type ? user.user_type.toUpperCase() : 'STUDENT'
  );

  // Helper to calculate price per seat based on category and attendee type
  const getSeatPrice = (categoryName, attendeeType) => {
    if (!prices || prices.length === 0) return 0;
    const cat = prices.find(
      (p) => p.category_name?.toLowerCase() === categoryName?.toLowerCase()
    );
    if (!cat) return 0;

    const type = (attendeeType || 'STUDENT').toUpperCase();
    if (type === 'STUDENT') return parseFloat(cat.student_price) || 0;
    if (type === 'FACULTY') return parseFloat(cat.faculty_price) || 0;
    if (type === 'GUEST') return parseFloat(cat.guest_price) || 0;
    return parseFloat(cat.student_price) || 0;
  };

  // Subtotal calculation
  const estimatedTotal = selectedSeats.reduce((sum, s) => {
    return sum + getSeatPrice(s.category_name, s.attendee_type);
  }, 0);

  // Toggle seat selection
  const handleSeatClick = (seat) => {
    if (seat.status !== 'free') return;
    const seatNo = seat.seat_no || seat.seat_number;
    const isSelected = selectedSeats.some(
      (s) => s.row_label === seat.row_label && s.seat_no === seatNo
    );

    if (isSelected) {
      setSelectedSeats((prev) =>
        prev.filter((s) => !(s.row_label === seat.row_label && s.seat_no === seatNo))
      );
      setSelectionError('');
    } else {
      if (selectedSeats.length >= 6) {
        setSelectionError('You can select a maximum of 6 tickets per booking (Rule BR6).');
        return;
      }
      // When a student books tickets, all tickets default to Student rate
      const defaultType = user?.user_type ? user.user_type.toUpperCase() : 'STUDENT';

      setSelectedSeats((prev) => [
        ...prev,
        {
          row_label: seat.row_label,
          seat_no: seatNo,
          category_name: seat.category_name || (seat.row_label >= 'O' ? 'Gold' : 'Silver'),
          attendee_type: defaultType,
        },
      ]);
      setSelectionError('');
    }
  };

  // Change attendee type for a selected seat
  const handleAttendeeTypeChange = (rowLabel, seatNo, newType) => {
    setSelectionError('');
    setSelectedSeats((prev) =>
      prev.map((s) =>
        s.row_label === rowLabel && s.seat_no === seatNo
          ? { ...s, attendee_type: newType }
          : s
      )
    );
  };

  // Remove a seat from selection
  const handleRemoveSeat = (rowLabel, seatNo) => {
    setSelectedSeats((prev) =>
      prev.filter((s) => !(s.row_label === rowLabel && s.seat_no === seatNo))
    );
  };

  // Submit hold request to backend
  const handleCreateHold = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsSubmitting(true);
      setSelectionError('');

      let payload;
      if (venueType === 'classroom') {
        const capacity = classroomData?.capacity || 0;
        const remaining = classroomData?.remaining ?? capacity;
        const maxPasses = Math.max(0, Math.min(6, remaining));
        payload = {
          show_id: showId,
          ticket_count: Math.min(classroomQty, maxPasses || 1),
          tickets: [],
        };
      } else {
        if (selectedSeats.length === 0) {
          setSelectionError('Please select at least 1 seat before proceeding.');
          setIsSubmitting(false);
          return;
        }

        payload = {
          show_id: showId,
          tickets: selectedSeats.map((s) => ({
            row_label: s.row_label,
            seat_no: s.seat_no,
            attendee_type: s.attendee_type,
          })),
        };
      }

      const res = await api.post('/bookings', payload);
      // Navigate to checkout with the returned booking ID
      navigate(`/checkout/${res.booking.booking_id}`);
    } catch (err) {
      if (err.code === 'SEAT_TAKEN') {
        setSelectionError(
          'One or more of your selected seats were just taken by another attendee. Please select different seats.'
        );
        if (onRefresh) onRefresh();
      } else if (err.code === 'TICKET_LIMIT') {
        setSelectionError(err.message || 'Maximum 6 tickets allowed per booking.');
      } else {
        setSelectionError(err.message || 'Failed to hold seats. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. CLASSROOM VENUE TYPE (General Admission)
  // ─────────────────────────────────────────────────────────────
  if (venueType === 'classroom') {
    const capacity = classroomData?.capacity || 0;
    const remaining = classroomData?.remaining ?? capacity;
    const booked = classroomData?.booked_count || (capacity - remaining);
    const occupancyPercent = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    const isSoldOut = remaining <= 0;
    const maxPasses = Math.max(0, Math.min(6, remaining));
    const effectiveQty = isSoldOut ? 0 : Math.min(classroomQty, maxPasses || 1);

    const classroomPrice = getSeatPrice('General', classroomAttendeeType);
    const classroomTotal = classroomPrice * effectiveQty;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{venueName || 'Lecture Hall'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">General Admission (Unreserved Seating)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'
                }`}
              ></span>
              Live Sync
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Refresh availability"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Capacity Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 font-medium">Total Capacity</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{capacity}</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
            <span className="text-xs text-emerald-700 font-medium">Available Passes</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{remaining}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
            <span className="text-xs text-blue-700 font-medium">Booked / On Hold</span>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">{booked}</div>
          </div>
        </div>

        {/* Occupancy Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-xs font-semibold text-slate-600">
            <span>Occupancy</span>
            <span>{occupancyPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                occupancyPercent > 85
                  ? 'bg-red-500'
                  : occupancyPercent > 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, occupancyPercent)}%` }}
            />
          </div>
        </div>

        {selectionError && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{selectionError}</span>
          </div>
        )}

        {/* Quantity and Booking Card */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Passes (Max {maxPasses})
              </span>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  disabled={effectiveQty <= 1 || isSoldOut}
                  onClick={() => setClassroomQty((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  -
                </button>
                <span className="text-lg font-bold text-slate-900 w-8 text-center font-mono">
                  {effectiveQty}
                </span>
                <button
                  type="button"
                  disabled={effectiveQty >= maxPasses || isSoldOut}
                  onClick={() =>
                    setClassroomQty((prev) => Math.min(maxPasses, prev + 1))
                  }
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Attendee Tier
              </span>
              <div className="mt-2">
                <select
                  value={classroomAttendeeType}
                  onChange={(e) => setClassroomAttendeeType(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-800"
                >
                  <option value="STUDENT">Student (₹{getSeatPrice('General', 'STUDENT')})</option>
                  <option value="FACULTY">Faculty (₹{getSeatPrice('General', 'FACULTY')})</option>
                  <option value="GUEST">Guest (₹{getSeatPrice('General', 'GUEST')})</option>
                </select>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500">Total Price</span>
              <div className="text-2xl font-extrabold text-slate-900">₹{classroomTotal}</div>
            </div>
          </div>

          <button
            type="button"
            disabled={isSoldOut || isSubmitting || maxPasses <= 0}
            onClick={handleCreateHold}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reserving Your Passes...
              </>
            ) : isSoldOut ? (
              'Classroom Capacity Full'
            ) : !user ? (
              'Log in to Hold Passes'
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Hold {effectiveQty} {effectiveQty === 1 ? 'Pass' : 'Passes'} & Proceed to Pay (₹
                {classroomTotal})
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AUDITORIUM VENUE TYPE (500 Numbered Seats in Straight Horizontal Rows)
  // ─────────────────────────────────────────────────────────────
  // Group seats by row_label
  const rowsMap = {};
  for (const seat of seats) {
    if (!rowsMap[seat.row_label]) {
      rowsMap[seat.row_label] = [];
    }
    rowsMap[seat.row_label].push(seat);
  }

  // Sort rows alphabetically and seats numerically
  const sortedRowLabels = Object.keys(rowsMap).sort();
  sortedRowLabels.forEach((r) => {
    rowsMap[r].sort(
      (a, b) => (a.seat_no || a.seat_number) - (b.seat_no || b.seat_number)
    );
  });

  const totalSeats = seats.length;
  const freeSeats = seats.filter((s) => s.status === 'free').length;
  const heldSeats = seats.filter((s) => s.status === 'held').length;
  const soldSeats = seats.filter((s) => s.status === 'sold').length;

  const goldSeatsCount = seats.filter((s) => s.category_name?.toLowerCase() === 'gold').length;
  const silverSeatsCount = seats.filter(
    (s) => s.category_name?.toLowerCase() === 'silver'
  ).length;

  const displayedRowLabels = sortedRowLabels.filter((rowLabel) => {
    if (tierFilter === 'ALL') return true;
    const cat = rowsMap[rowLabel]?.[0]?.category_name?.toUpperCase();
    if (tierFilter === 'GOLD') return cat === 'GOLD';
    if (tierFilter === 'SILVER') return cat === 'SILVER';
    return true;
  });

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.0, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(1, +(prev - 0.25).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm">
      {/* Top Header & Polling Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">
              {venueName || 'Main Auditorium'} — Interactive Seating
            </h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              500 Seats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click available green seats to reserve (max 6). Holds lock seats for 5 minutes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'
              }`}
            ></span>
            Live SSE Active
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh availability"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tier Filter Tabs & Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        {/* Tier filter tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTierFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              tierFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Tiers ({totalSeats})
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('GOLD')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tierFilter === 'GOLD'
                ? 'bg-amber-500 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Balcony Gold ({goldSeatsCount})
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('SILVER')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              tierFilter === 'SILVER'
                ? 'bg-slate-700 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stalls Silver ({silverSeatsCount})
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 px-2 min-w-[44px] text-center font-mono">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2}
            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Zoom in to enlarge seats"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoomLevel > 1 && (
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 transition-colors"
              title="Reset view (Fit all seats)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {selectionError && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Booking Notice:</span> {selectionError}
          </div>
          <button
            onClick={() => setSelectionError('')}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Active Seat Inspector Bar */}
      <div className="mb-5 py-2 px-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600 min-h-[36px]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {hoveredSeat ? (
            (() => {
              const isGold = hoveredSeat.category_name?.toLowerCase() === 'gold';
              const seatNo = hoveredSeat.seat_no || hoveredSeat.seat_number;
              const isSelected = selectedSeats.some(
                (s) => s.row_label === hoveredSeat.row_label && s.seat_no === seatNo
              );
              return (
                <span>
                  Row <strong className="text-slate-900 font-bold">{hoveredSeat.row_label}</strong>
                  , Seat <strong className="text-slate-900 font-bold">{seatNo}</strong> •{' '}
                  <span className={isGold ? 'text-amber-700 font-bold' : 'text-slate-700 font-bold'}>
                    {isGold ? 'Balcony (Gold Tier)' : 'Stalls (Silver Tier)'}
                  </span>{' '}
                  • Status:{' '}
                  <strong
                    className={
                      isSelected
                        ? 'text-emerald-700 font-extrabold'
                        : hoveredSeat.status === 'free'
                        ? 'text-emerald-600'
                        : hoveredSeat.status === 'held'
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }
                  >
                    {isSelected
                      ? 'Selected (Click to deselect)'
                      : hoveredSeat.status === 'free'
                      ? 'Available (Click to select)'
                      : hoveredSeat.status === 'held'
                      ? 'On Hold'
                      : 'Booked'}
                  </strong>
                </span>
              );
            })()
          ) : (
            <span className="text-slate-400 italic">
              Click any green seat to pick • Up to 6 seats per booking
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-400 hidden sm:block">
          {selectedSeats.length > 0
            ? `${selectedSeats.length} of 6 seats selected`
            : 'Compact fit: View all 500 seats without scrolling'}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-7 text-xs font-semibold text-slate-600 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 border border-emerald-600"></span>
          <span>Available ({freeSeats})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-700 border-2 border-emerald-300 ring-1 ring-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">
            ✓
          </span>
          <span>Selected ({selectedSeats.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-amber-400 border border-amber-500 animate-pulse"></span>
          <span>On Hold ({heldSeats})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-300 border border-slate-400"></span>
          <span>Booked ({soldSeats})</span>
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="max-w-md mx-auto mb-6 text-center">
        <div className="h-2 bg-gradient-to-r from-emerald-200 via-emerald-500 to-emerald-200 rounded-full shadow-sm mb-1.5" />
        <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-400">
          Stage / Screen
        </span>
      </div>

      {/* Straight Horizontal Seating Grid (Clean White Background) */}
      <div className="overflow-x-auto pb-4 pt-1 transition-all">
        <div
          className="flex flex-col items-center space-y-1.5 transition-transform duration-200 origin-top min-w-max px-2"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {displayedRowLabels.map((rowLabel) => {
            const rowSeats = rowsMap[rowLabel] || [];
            const isGold = rowSeats[0]?.category_name?.toLowerCase() === 'gold';
            const showBalconyDivider = rowLabel === 'O' && tierFilter === 'ALL';

            return (
              <React.Fragment key={rowLabel}>
                {/* Clean Gold Balcony Tier Divider */}
                {showBalconyDivider && (
                  <div className="w-full my-3 flex items-center justify-center gap-3">
                    <div className="flex-1 h-px bg-amber-200"></div>
                    <span className="px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold tracking-wide">
                      UPPER BALCONY — GOLD TIER (ROWS O–T • 150 SEATS)
                    </span>
                    <div className="flex-1 h-px bg-amber-200"></div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 group">
                  {/* Left Row Indicator */}
                  <div className="w-5 text-right font-mono font-bold text-[11px] text-slate-400 group-hover:text-slate-700 transition-colors">
                    {rowLabel}
                  </div>

                  {/* 25 Straight Seats with 2 Aisles (Left Wing: 1-7, Center: 8-18, Right Wing: 19-25) */}
                  <div className="flex items-center gap-1">
                    {rowSeats.map((seat) => {
                      const seatNo = seat.seat_no || seat.seat_number;
                      // Two aisles after seat 7 and seat 18
                      const isLeftAisle = seatNo === 7;
                      const isRightAisle = seatNo === 18;

                      const isSelected = selectedSeats.some(
                        (s) => s.row_label === rowLabel && s.seat_no === seatNo
                      );

                      let seatColor =
                        'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs cursor-pointer';
                      let statusLabel = 'Available';

                      if (isSelected) {
                        seatColor =
                          'bg-emerald-700 text-white ring-2 ring-emerald-300 font-extrabold shadow-md scale-110 z-10';
                        statusLabel = 'Selected';
                      } else if (seat.status === 'held') {
                        seatColor =
                          'bg-amber-400 text-amber-950 font-bold border border-amber-500 animate-pulse cursor-not-allowed';
                        statusLabel = 'On Hold';
                      } else if (seat.status === 'sold') {
                        seatColor =
                          'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed line-through';
                        statusLabel = 'Booked';
                      }

                      const tierRing = isGold && !isSelected ? 'ring-1 ring-amber-300' : '';

                      return (
                        <React.Fragment key={`${rowLabel}-${seatNo}`}>
                          <button
                            type="button"
                            disabled={seat.status !== 'free'}
                            onClick={() => handleSeatClick(seat)}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            title={`Row ${rowLabel}, Seat ${seatNo} (${seat.category_name}) — ${statusLabel}`}
                            className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md flex items-center justify-center text-[9px] font-semibold transition-all transform hover:scale-125 hover:z-20 ${tierRing} ${seatColor}`}
                          >
                            {isSelected ? '✓' : seatNo}
                          </button>

                          {/* Aisle Spacer */}
                          {(isLeftAisle || isRightAisle) && (
                            <div className="w-4 text-center text-[10px] text-slate-300 font-mono select-none">
                              •
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Right Row Indicator */}
                  <div className="w-5 text-left font-mono font-bold text-[11px] text-slate-400 group-hover:text-slate-700 transition-colors">
                    {rowLabel}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SELECTION SUMMARY & HOLD ACTION DOCK
         ───────────────────────────────────────────────────────────── */}
      {selectedSeats.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200 bg-slate-50/80 p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200/70">
            <div>
              <div className="flex items-center gap-2.5">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-emerald-600" />
                  Selected Seats
                </h4>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {selectedSeats.length} of 6 seats
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Student rate applied by default. You can adjust attendee rates below.
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Estimated Subtotal</span>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight">₹{estimatedTotal}</div>
            </div>
          </div>

          {/* Seat chips and attendee type dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {selectedSeats.map((s) => {
              const price = getSeatPrice(s.category_name, s.attendee_type);
              const isGold = s.category_name?.toLowerCase() === 'gold';
              return (
                <div
                  key={`${s.row_label}-${s.seat_no}`}
                  className="bg-white border border-slate-200 hover:border-emerald-400 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-2.5"
                >
                  {/* Top Row: Seat Identifier & Tier Pill & Remove */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
                        Row {s.row_label}, Seat {s.seat_no}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                          isGold
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {s.category_name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSeat(s.row_label, s.seat_no)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors shrink-0"
                      title="Remove seat"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom Row: Rate Selector & Price */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Rate:</span>
                      <select
                        value={s.attendee_type}
                        onChange={(e) =>
                          handleAttendeeTypeChange(s.row_label, s.seat_no, e.target.value)
                        }
                        className="px-2 py-0.5 rounded-md border border-slate-200 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="STUDENT">Student</option>
                        <option value="FACULTY">Faculty</option>
                        <option value="GUEST">Guest</option>
                      </select>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 text-base">₹{price}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Policy Note */}
          <div className="mb-4 flex items-center justify-between text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Student rate applies to all tickets booked under your account.</span>
            </span>
            <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
              Rule BR6: Max 6
            </span>
          </div>

          {/* Inline Selection Error Banner right above Hold Button */}
          {selectionError && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{selectionError}</div>
              <button
                type="button"
                onClick={() => setSelectionError('')}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Hold Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCreateHold}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reserving Your Seats in Database...
              </>
            ) : !user ? (
              'Log in to Hold Seats'
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Hold {selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'} & Proceed
                to Checkout (₹{estimatedTotal})
              </>
            )}
          </button>
        </div>
      )}

      {selectedSeats.length === 0 && (
        <div className="mt-6 text-center text-xs text-slate-400">
          Click any available green seat above to start your reservation.
        </div>
      )}
    </div>
  );
}
