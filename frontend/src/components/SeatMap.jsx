// ─────────────────────────────────────────────────────────────
// frontend/src/components/SeatMap.jsx
// Authentic Curved Amphitheater Auditorium (500 Seats) with Interactive Zoom
// Matches circular arc layout with Left, Center, Right sectors & 2 aisles
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useMemo } from 'react';
import {
  Users,
  Info,
  RefreshCw,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldCheck,
  RotateCcw,
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
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1, 1.4, 1.8, 2.4
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 1. CLASSROOM VENUE TYPE (General Admission)
  if (venueType === 'classroom') {
    const capacity = classroomData?.capacity || 0;
    const remaining = classroomData?.remaining ?? capacity;
    const booked = classroomData?.booked_count || (capacity - remaining);
    const occupancyPercent = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {venueName || 'Lecture Hall'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">General Admission (No assigned seat numbers)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`}></span>
              Live Sync Active
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200/60"
                title="Refresh availability"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Capacity Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 font-medium">Total Capacity</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{capacity}</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
            <span className="text-xs text-emerald-700 font-medium">Available Passes</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{remaining}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
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

        <div className="flex items-start gap-2.5 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-800 leading-relaxed">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            Classroom events offer unreserved seating. Booking confirms your entry badge, and seats are selected on arrival.
          </span>
        </div>
      </div>
    );
  }

  // 2. AUDITORIUM VENUE TYPE (Concentric Curved Amphitheater with 500 Seats)
  // Map seats into quick lookup by row_label and seat_no
  const seatLookup = useMemo(() => {
    const map = new Map();
    for (const s of seats) {
      map.set(`${s.row_label}-${s.seat_no || s.seat_number}`, s);
    }
    return map;
  }, [seats]);

  const totalSeats = seats.length;
  const freeSeats = seats.filter((s) => s.status === 'free').length;
  const heldSeats = seats.filter((s) => s.status === 'held').length;
  const soldSeats = seats.filter((s) => s.status === 'sold').length;

  const goldSeatsCount = seats.filter((s) => s.category_name?.toLowerCase() === 'gold').length;
  const silverSeatsCount = seats.filter((s) => s.category_name?.toLowerCase() === 'silver').length;

  // Concentric arc geometry settings
  const CX = 500;
  const CY = 610; // Stage center position
  const BASE_R = 195; // Radius of Row A closest to stage
  const ROW_STEP = 16.5; // Radial distance between successive rows
  const SEAT_RADIUS = 5.2; // Size of individual seat dot

  // Rows A through T (20 rows)
  const ROW_LABELS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  ];

  // Radial angles for 25 seats per row (Left wing: 1-7, Center: 8-18, Right wing: 19-25)
  // Total span from -60 degrees to +60 degrees
  const seatAngles = useMemo(() => {
    const angles = [];
    // Left Wing (seats 1 to 7): spans -59° to -26°
    for (let i = 0; i < 7; i++) {
      angles.push(-59 + (i * (33 / 6)));
    }
    // Center Section (seats 8 to 18): spans -18° to +18°
    for (let i = 0; i < 11; i++) {
      angles.push(-18 + (i * (36 / 10)));
    }
    // Right Wing (seats 19 to 25): spans +26° to +59°
    for (let i = 0; i < 7; i++) {
      angles.push(26 + (i * (33 / 6)));
    }
    return angles;
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.5, +(prev + 0.35).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1, +(prev - 0.35).toFixed(2));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse pan handlers when zoomed in
  const handleMouseDown = (e) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm select-none">
      {/* Header with Title and Polling Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {venueName || 'Main Auditorium'}
            </h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              500 Seats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Concentric Curved Amphitheater • {freeSeats} seats currently available
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`}></span>
            Live Polling Active
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200/60"
              title="Refresh availability now"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tier Filter Tabs, Inspector Chip, and Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        {/* Tier filter tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60 text-xs font-semibold">
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
            <Sparkles className="w-3 h-3 text-amber-200" />
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
          <span className="text-xs font-bold text-slate-700 px-2 min-w-[48px] text-center font-mono">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2.5}
            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Zoom in to pick individual seats"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoomLevel > 1 && (
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 transition-colors"
              title="Reset view (Fit all 500 seats)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Active Seat Inspector Bar */}
      <div className="mb-4 py-2 px-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600 min-h-[38px]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {hoveredSeat || selectedSeat ? (
            (() => {
              const current = hoveredSeat || selectedSeat;
              const isGold = current.category_name?.toLowerCase() === 'gold';
              return (
                <span>
                  Row <strong className="text-slate-900 text-sm font-bold">{current.row_label}</strong>, Seat{' '}
                  <strong className="text-slate-900 text-sm font-bold">{current.seat_no}</strong> •{' '}
                  <span className={isGold ? 'text-amber-700 font-bold' : 'text-slate-700 font-bold'}>
                    {isGold ? 'Balcony (Gold Tier)' : 'Stalls (Silver Tier)'}
                  </span>{' '}
                  • Status:{' '}
                  <strong
                    className={
                      current.status === 'free'
                        ? 'text-emerald-600'
                        : current.status === 'held'
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }
                  >
                    {current.status === 'free' ? 'Available' : current.status === 'held' ? 'On Hold' : 'Booked'}
                  </strong>
                </span>
              );
            })()
          ) : (
            <span className="text-slate-400 italic">
              Hover over or tap any seat to inspect • Click Zoom buttons (+) to magnify seat numbers
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-400 hidden sm:block">
          {zoomLevel > 1 ? 'Drag to pan across the amphitheater' : 'Fit View: Entire auditorium visible without scrolling'}
        </div>
      </div>

      {/* Main SVG Amphitheater Viewport */}
      <div
        className={`relative w-full rounded-2xl border border-slate-200/80 bg-slate-950 overflow-hidden shadow-inner flex items-center justify-center ${
          zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        style={{ height: '460px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox="0 0 1000 580"
          className="w-full h-full transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: '500px 380px',
          }}
        >
          <defs>
            {/* Subtle glow filter for stage */}
            <radialGradient id="stageGlow" cx="50%" cy="100%" r="90%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>

            {/* Balcony divider gradient */}
            <linearGradient id="goldBalconyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Stage Glow Area */}
          <ellipse cx={CX} cy={CY - 40} rx={180} ry={70} fill="url(#stageGlow)" />

          {/* Radial Aisle Guidelines (Subtle background paths for Left and Right aisles) */}
          <line
            x1={CX + 185 * Math.sin((-22 * Math.PI) / 180)}
            y1={CY - 185 * Math.cos((-22 * Math.PI) / 180)}
            x2={CX + 540 * Math.sin((-22 * Math.PI) / 180)}
            y2={CY - 540 * Math.cos((-22 * Math.PI) / 180)}
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <line
            x1={CX + 185 * Math.sin((22 * Math.PI) / 180)}
            y1={CY - 185 * Math.cos((22 * Math.PI) / 180)}
            x2={CX + 540 * Math.sin((22 * Math.PI) / 180)}
            y2={CY - 540 * Math.cos((22 * Math.PI) / 180)}
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.5"
          />

          {/* Stage Apron Arc & Label (at the bottom, just like the real auditorium diagram) */}
          <path
            d={`M ${CX - 150} ${CY - 60} Q ${CX} ${CY - 110} ${CX + 150} ${CY - 60}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d={`M ${CX - 150} ${CY - 60} Q ${CX} ${CY - 110} ${CX + 150} ${CY - 60} L ${CX + 130} ${CY - 30} Q ${CX} ${CY - 70} ${CX - 130} ${CY - 30} Z`}
            fill="#064e3b"
            opacity="0.8"
          />
          <text
            x={CX}
            y={CY - 75}
            textAnchor="middle"
            fill="#a7f3d0"
            fontSize="18"
            fontWeight="900"
            letterSpacing="6"
          >
            STAGE
          </text>

          {/* Elevated Balcony Header Arc (Top of the auditorium) */}
          <path
            d={`M ${CX + 525 * Math.sin((-45 * Math.PI) / 180)} ${CY - 525 * Math.cos((-45 * Math.PI) / 180)} A 525 525 0 0 1 ${CX + 525 * Math.sin((45 * Math.PI) / 180)} ${CY - 525 * Math.cos((45 * Math.PI) / 180)}`}
            fill="none"
            stroke="url(#goldBalconyGrad)"
            strokeWidth="2"
          />
          <text
            x={CX}
            y={CY - 534}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="11"
            fontWeight="bold"
            letterSpacing="2"
          >
            ELEVATED BALCONY — GOLD TIER (ROWS O–T • 150 SEATS)
          </text>

          {/* Concentric Rows A through T */}
          {ROW_LABELS.map((rowLabel, rowIdx) => {
            const isGold = rowIdx >= 14; // Rows O-T (indices 14-19) are Gold (150 seats)
            const r = BASE_R + rowIdx * ROW_STEP;

            // Check if this row is hidden by tier filter
            if (tierFilter === 'GOLD' && !isGold) return null;
            if (tierFilter === 'SILVER' && isGold) return null;

            // Row arc guide line
            const startAng = -61;
            const endAng = 61;
            const radStart = (startAng * Math.PI) / 180;
            const radEnd = (endAng * Math.PI) / 180;
            const startX = CX + r * Math.sin(radStart);
            const startY = CY - r * Math.cos(radStart);
            const endX = CX + r * Math.sin(radEnd);
            const endY = CY - r * Math.cos(radEnd);

            return (
              <g key={rowLabel} className="transition-opacity duration-200">
                {/* Subtle row guide arc */}
                <path
                  d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
                  fill="none"
                  stroke={isGold ? '#78350f' : '#1e293b'}
                  strokeWidth="0.8"
                  opacity={isGold ? 0.6 : 0.4}
                />

                {/* Left Row Label */}
                <text
                  x={CX + (r + 4) * Math.sin(((-63.5) * Math.PI) / 180)}
                  y={CY - (r + 4) * Math.cos(((-63.5) * Math.PI) / 180) + 3}
                  textAnchor="end"
                  fill={isGold ? '#f59e0b' : '#94a3b8'}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {rowLabel}
                </text>

                {/* Right Row Label */}
                <text
                  x={CX + (r + 4) * Math.sin(((63.5) * Math.PI) / 180)}
                  y={CY - (r + 4) * Math.cos(((63.5) * Math.PI) / 180) + 3}
                  textAnchor="start"
                  fill={isGold ? '#f59e0b' : '#94a3b8'}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {rowLabel}
                </text>

                {/* 25 Seats along the row arc */}
                {seatAngles.map((angle, sIdx) => {
                  const seatNo = sIdx + 1;
                  const rad = (angle * Math.PI) / 180;
                  const x = CX + r * Math.sin(rad);
                  const y = CY - r * Math.cos(rad);

                  const seatObj = seatLookup.get(`${rowLabel}-${seatNo}`) || {
                    row_label: rowLabel,
                    seat_no: seatNo,
                    category_name: isGold ? 'Gold' : 'Silver',
                    status: 'free',
                  };

                  let fillColor = '#10b981'; // Free = Emerald
                  let strokeColor = '#059669';

                  if (isGold) {
                    fillColor = '#10b981';
                    strokeColor = '#f59e0b'; // Gold border for premium tier
                  }

                  if (seatObj.status === 'held') {
                    fillColor = '#f59e0b'; // Held = Pulsing Amber
                    strokeColor = '#d97706';
                  } else if (seatObj.status === 'sold') {
                    fillColor = '#475569'; // Sold = Slate Gray
                    strokeColor = '#334155';
                  }

                  const isHovered =
                    (hoveredSeat?.row_label === rowLabel && hoveredSeat?.seat_no === seatNo) ||
                    (selectedSeat?.row_label === rowLabel && selectedSeat?.seat_no === seatNo);

                  return (
                    <g
                      key={`${rowLabel}-${seatNo}`}
                      onMouseEnter={() => setHoveredSeat(seatObj)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      onClick={() => setSelectedSeat(seatObj)}
                      className="cursor-pointer"
                    >
                      {/* Seat Circle / Dot */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? SEAT_RADIUS + 2.5 : SEAT_RADIUS}
                        fill={isHovered ? '#34d399' : fillColor}
                        stroke={isHovered ? '#ffffff' : strokeColor}
                        strokeWidth={isHovered ? 2 : isGold ? 1.4 : 0.8}
                        className="transition-all duration-100"
                      />

                      {/* Seat Number (visible when zoomed in or hovered) */}
                      {(zoomLevel >= 1.6 || isHovered) && (
                        <text
                          x={x}
                          y={y + 2.8}
                          textAnchor="middle"
                          fill={seatObj.status === 'sold' ? '#cbd5e1' : '#ffffff'}
                          fontSize={isHovered ? '6.5' : '5.5'}
                          fontWeight="bold"
                          pointerEvents="none"
                        >
                          {seatNo}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* In-canvas Mini Overlay Controls */}
        <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md backdrop-blur-xs border border-slate-800">
          Left Wing (1–7) • Center (8–18) • Right Wing (19–25)
        </div>
      </div>

      {/* Legend & Specifications Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600 bg-slate-50 py-3 px-5 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-600 shadow-sm"></span>
            <span>Available ({freeSeats})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-500 animate-pulse"></span>
            <span>On Hold ({heldSeats})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-500 border border-slate-600"></span>
            <span>Booked ({soldSeats})</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-500 text-[11px]">
          <div className="flex items-center gap-1 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500 inline-block"></span>
            <span>Gold Balcony: Rows O–T (150 Seats)</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-700 inline-block"></span>
            <span>Silver Stalls: Rows A–N (350 Seats)</span>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Curved layout: 2 aisles, 20 rows, 25 seats per row. No scrolling needed to view all 500 seats.</span>
        </div>
        {lastUpdated && (
          <span>Live sync: {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
