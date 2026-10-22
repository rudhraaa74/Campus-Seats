// ─────────────────────────────────────────────────────────────
// frontend/src/components/SeatMap.jsx
// Clean White 500-Seat Curved Auditorium & Classroom Availability Map
// Preserves original clean UI aesthetics with curved aisles & zoom controls
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
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
} from 'lucide-react';

export function SeatMap({
  venueType = 'auditorium',
  venueName = '',
  seats = [],
  classroomData = null,
  isPolling = false,
  lastUpdated = null,
  onRefresh,
}) {
  const [tierFilter, setTierFilter] = useState('ALL'); // 'ALL' | 'GOLD' | 'SILVER'
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 (fit), 1.25, 1.5, 2.0

  // 1. CLASSROOM VENUE TYPE (General Admission)
  if (venueType === 'classroom') {
    const capacity = classroomData?.capacity || 0;
    const remaining = classroomData?.remaining ?? capacity;
    const booked = classroomData?.booked_count || (capacity - remaining);
    const occupancyPercent = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{venueName || 'Lecture Hall'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">General Admission (No assigned seat numbers)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`}></span>
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

        <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            Classroom events offer unreserved seating. Booking confirms your entry badge, and seats are selected on arrival.
          </span>
        </div>
      </div>
    );
  }

  // 2. AUDITORIUM VENUE TYPE (500 Numbered Seats in Curved Amphitheater)
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
    rowsMap[r].sort((a, b) => (a.seat_no || a.seat_number) - (b.seat_no || b.seat_number));
  });

  const totalSeats = seats.length;
  const freeSeats = seats.filter((s) => s.status === 'free').length;
  const heldSeats = seats.filter((s) => s.status === 'held').length;
  const soldSeats = seats.filter((s) => s.status === 'sold').length;

  const goldSeatsCount = seats.filter((s) => s.category_name?.toLowerCase() === 'gold').length;
  const silverSeatsCount = seats.filter((s) => s.category_name?.toLowerCase() === 'silver').length;

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
            <h3 className="text-lg font-bold text-slate-900">{venueName || 'Main Auditorium'} — Live Seat Map</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              500 Seats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {freeSeats} of {totalSeats} seats currently available
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`}></span>
            Live Polling Active
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
            title="Zoom in to pick individual seats"
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

      {/* Floating Active Seat Inspector Bar */}
      <div className="mb-5 py-2 px-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600 min-h-[36px]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {hoveredSeat ? (
            (() => {
              const isGold = hoveredSeat.category_name?.toLowerCase() === 'gold';
              return (
                <span>
                  Row <strong className="text-slate-900 font-bold">{hoveredSeat.row_label}</strong>, Seat{' '}
                  <strong className="text-slate-900 font-bold">{hoveredSeat.seat_no || hoveredSeat.seat_number}</strong> •{' '}
                  <span className={isGold ? 'text-amber-700 font-bold' : 'text-slate-700 font-bold'}>
                    {isGold ? 'Balcony (Gold Tier)' : 'Stalls (Silver Tier)'}
                  </span>{' '}
                  • Status:{' '}
                  <strong
                    className={
                      hoveredSeat.status === 'free'
                        ? 'text-emerald-600'
                        : hoveredSeat.status === 'held'
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }
                  >
                    {hoveredSeat.status === 'free' ? 'Available' : hoveredSeat.status === 'held' ? 'On Hold' : 'Booked'}
                  </strong>
                </span>
              );
            })()
          ) : (
            <span className="text-slate-400 italic">
              Hover any seat to inspect • Use Zoom (+) if you wish to enlarge seats
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-400 hidden sm:block">
          {zoomLevel > 1 ? 'Scroll or drag to pan' : 'Compact fit: View all 500 seats without scrolling'}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-7 text-xs font-semibold text-slate-600 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 border border-emerald-600"></span>
          <span>Available ({freeSeats})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-amber-400 border border-amber-500 animate-pulse"></span>
          <span>On Hold ({heldSeats})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-300 border border-slate-400"></span>
          <span>Booked ({soldSeats})</span>
        </div>
        <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
        <div className="flex items-center gap-1.5 text-amber-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
          <span>Gold Balcony: Rows O–T</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>Silver Stalls: Rows A–N</span>
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="max-w-md mx-auto mb-6 text-center">
        <div className="h-2 bg-gradient-to-r from-emerald-200 via-emerald-500 to-emerald-200 rounded-full shadow-sm mb-1.5" />
        <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-400">
          Stage / Screen
        </span>
      </div>

      {/* Auditorium Seating Grid (Clean White Background) */}
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

                      let seatColor = 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs';
                      let statusLabel = 'Available';

                      if (seat.status === 'held') {
                        seatColor = 'bg-amber-400 text-amber-950 font-bold border border-amber-500 animate-pulse cursor-not-allowed';
                        statusLabel = 'On Hold';
                      } else if (seat.status === 'sold') {
                        seatColor = 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed line-through';
                        statusLabel = 'Booked';
                      }

                      const tierRing = isGold ? 'ring-1 ring-amber-300' : '';

                      return (
                        <React.Fragment key={`${rowLabel}-${seatNo}`}>
                          <button
                            type="button"
                            disabled={seat.status !== 'free'}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            title={`Row ${rowLabel}, Seat ${seatNo} (${seat.category_name}) — ${statusLabel}`}
                            className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md flex items-center justify-center text-[9px] font-semibold transition-all transform hover:scale-125 hover:z-20 ${tierRing} ${seatColor}`}
                          >
                            {seatNo}
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

      <div className="mt-6 text-center text-xs text-slate-400">
        Auditorium seats refresh automatically every few seconds. Click zoom in (+) if you wish to enlarge individual seats.
      </div>
    </div>
  );
}
