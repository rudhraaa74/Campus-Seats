// ─────────────────────────────────────────────────────────────
// frontend/src/pages/TicketPrint.jsx
// Print-friendly attendee E-Ticket view with QR code for each ticket
// Adheres to DBMS constraints: reads ticket_id and booking data without schema change
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../api/client.js';
import {
  Printer,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export function TicketPrint() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [qrCodes, setQrCodes] = useState({}); // ticket_id -> dataURL
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadBooking() {
      try {
        setLoading(true);
        setError('');
        const data = await api.get(`/bookings/${id}`);
        const b = data.booking;
        if (!isMounted) return;
        setBooking(b);

        // Generate QR codes for all active tickets
        if (b.tickets && b.tickets.length > 0) {
          const generated = {};
          for (const t of b.tickets) {
            // Encode ticket_id and booking_id into the QR payload
            const payload = JSON.stringify({
              app: 'SeatSync',
              ticket_id: t.ticket_id,
              booking_id: b.booking_id,
              show_id: b.show_id,
              seat: t.row_label ? `${t.row_label}-${t.seat_no || t.seat_number}` : 'GA',
              attendee: t.attendee_type,
            });
            const url = await QRCode.toDataURL(payload, {
              width: 140,
              margin: 1,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            generated[t.ticket_id] = url;
          }
          if (isMounted) {
            setQrCodes(generated);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to retrieve ticket details.');
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Generating your print-ready tickets...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="p-8 bg-white border border-red-200 rounded-3xl text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Unable to Display Ticket</h2>
          <p className="text-xs text-slate-500 mt-2">{error || 'Booking not found.'}</p>
          <Link
            to="/my-bookings"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const startDate = booking.start_time ? new Date(booking.start_time) : null;
  const formattedDate = startDate
    ? startDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Scheduled Show';
  const formattedTime = startDate
    ? startDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Print Controls Header - Hidden when printing */}
      <div className="no-print flex items-center justify-between pb-6 mb-8 border-b border-slate-200">
        <Link
          to="/my-bookings"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Bookings
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Official Campus Pass
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Non-confirmed Warning */}
      {!isConfirmed && (
        <div className="no-print mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            This booking has status <strong>{booking.status}</strong>. Only CONFIRMED bookings are valid for campus entry.
          </span>
        </div>
      )}

      {/* Printable Tickets Container */}
      <div className="space-y-8 print:space-y-6">
        {booking.tickets && booking.tickets.length > 0 ? (
          booking.tickets.map((t, idx) => {
            const isAuditorium = !!t.row_label;
            const seatLabel = isAuditorium
              ? `Row ${t.row_label} · Seat ${t.seat_no || t.seat_number}`
              : 'General Admission Pass';

            return (
              <div
                key={t.ticket_id}
                className="ticket-card bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-md print:shadow-none print:border-2 print:border-black print:rounded-2xl print:break-inside-avoid print:page-break-inside-avoid"
              >
                {/* Top Header Strip */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:bg-black print:text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wider uppercase text-emerald-400">
                        SeatSync · Campus Event Pass
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Organized by {booking.club_name || 'Campus Student Club'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Ticket Pass
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      #{idx + 1} of {booking.tickets.length}
                    </span>
                  </div>
                </div>

                {/* Main Ticket Layout */}
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Left 2 Cols: Event, Venue, Time, Seat */}
                  <div className="md:col-span-2 space-y-5">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mb-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {t.status || 'ACTIVE'} PASS
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                        {booking.event_title}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Date & Time
                        </span>
                        <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{formattedDate}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Venue Location
                        </span>
                        <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{booking.venue_name}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5 uppercase tracking-wide">
                          {booking.venue_type}
                        </div>
                      </div>
                    </div>

                    {/* Seat & Attendee Strip */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-3 gap-2 text-center print:bg-slate-100">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Seat / Allocation
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block">
                          {seatLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Category / Tier
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 block">
                          {t.category_name || (isAuditorium ? 'Auditorium' : 'General')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Attendee Tier
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5 block">
                          {t.attendee_type || 'STUDENT'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: QR Code & Ticket ID Verification */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center print:bg-white print:border-black">
                    {qrCodes[t.ticket_id] ? (
                      <img
                        src={qrCodes[t.ticket_id]}
                        alt={`QR Code for Ticket ${t.ticket_id}`}
                        className="w-32 h-32 object-contain rounded-lg border border-slate-200 shadow-2xs mb-2 bg-white p-1"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-slate-200 animate-pulse rounded-lg mb-2" />
                    )}

                    <div className="text-[11px] font-mono font-bold text-slate-900">
                      TICKET #{t.ticket_id}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      BOOKING #{booking.booking_id}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-bold mt-1">
                      ₹{parseFloat(t.price_paid || t.price || 0).toFixed(2)} Paid
                    </div>

                    <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>PostgreSQL Verified</span>
                    </div>
                  </div>
                </div>

                {/* Footer Tear-off / Verification Bar */}
                <div className="bg-slate-50 px-6 py-3 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 print:bg-white">
                  <span>
                    Present this QR pass at venue entrance along with your College ID.
                  </span>
                  <span className="font-mono">
                    Ref: CS-SH{booking.show_id}-TK{t.ticket_id}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
            <p className="text-xs text-slate-500">No active tickets found for this booking.</p>
          </div>
        )}
      </div>
    </div>
  );
}
