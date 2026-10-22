// ─────────────────────────────────────────────────────────────
// frontend/src/components/SeatMap.jsx
// Visual interactive seat availability map for Auditoriums and Classrooms
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Users, Info, RefreshCw } from 'lucide-react';

export function SeatMap({
  venueType = 'auditorium',
  venueName = '',
  seats = [],
  classroomData = null,
  isPolling = false,
  lastUpdated = null,
  onRefresh,
}) {
  // If venue is Classroom (general admission)
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

  // If venue is Auditorium (individual numbered seat grid)
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      {/* Header & Polling Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{venueName || 'Main Auditorium'} — Live Seat Map</h3>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-xs font-semibold text-slate-600 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100">
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
      </div>

      {/* Curved Stage Indicator */}
      <div className="max-w-md mx-auto mb-10 text-center">
        <div className="h-2 bg-gradient-to-r from-emerald-200 via-emerald-500 to-emerald-200 rounded-t-full shadow-sm mb-2" />
        <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-400">
          Stage / Screen
        </span>
      </div>

      {/* Seat Rows Grid */}
      <div className="space-y-3 overflow-x-auto pb-4">
        {sortedRowLabels.map((rowLabel) => {
          const rowSeats = rowsMap[rowLabel];
          const categoryName = rowSeats[0]?.category_name || '';

          return (
            <div key={rowLabel} className="flex items-center justify-center gap-3 min-w-max">
              {/* Row Label badge */}
              <div className="w-8 text-right font-mono font-bold text-xs text-slate-500">
                {rowLabel}
              </div>

              {/* Seats in Row */}
              <div className="flex items-center gap-1.5">
                {rowSeats.map((seat) => {
                  const seatNumber = seat.seat_no || seat.seat_number;
                  let seatColor = 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm';
                  let statusLabel = 'Available';

                  if (seat.status === 'held') {
                    seatColor = 'bg-amber-400 text-amber-950 font-bold border border-amber-500 animate-pulse cursor-not-allowed';
                    statusLabel = 'On Hold';
                  } else if (seat.status === 'sold') {
                    seatColor = 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed line-through';
                    statusLabel = 'Booked';
                  }

                  return (
                    <button
                      key={`${rowLabel}-${seatNumber}`}
                      type="button"
                      disabled={seat.status !== 'free'}
                      title={`Row ${rowLabel}, Seat ${seatNumber} (${seat.category_name}) — ${statusLabel}`}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all transform hover:scale-105 active:scale-95 ${seatColor}`}
                    >
                      {seatNumber}
                    </button>
                  );
                })}
              </div>

              {/* Category pill on right */}
              <div className="w-16 text-left pl-2">
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {categoryName}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        Auditorium seats refresh automatically every few seconds. Seat reservation will unlock in Phase 4.
      </div>
    </div>
  );
}
