// ─────────────────────────────────────────────────────────────
// frontend/src/components/ReportCharts.jsx
// Visual analytics charts using responsive CSS & SVG meters
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Award, Users, TrendingUp, Percent, IndianRupee } from 'lucide-react';

export function OccupancyChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No show occupancy data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const pct = parseFloat(item.occupancy_pct || 0);
        let barColor = 'bg-slate-400';
        let badgeColor = 'text-slate-700 bg-slate-100';

        if (pct >= 75) {
          barColor = 'bg-emerald-600';
          badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        } else if (pct >= 40) {
          barColor = 'bg-blue-600';
          badgeColor = 'text-blue-700 bg-blue-50 border-blue-200';
        } else if (pct > 0) {
          barColor = 'bg-amber-500';
          badgeColor = 'text-amber-700 bg-amber-50 border-amber-200';
        }

        return (
          <div key={item.show_id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{item.event_title}</h4>
                <div className="text-xs text-slate-500">
                  {item.venue_name} ({item.venue_type}) • {new Date(item.start_time).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">
                  {item.confirmed_tickets} / {item.total_capacity} seats
                </span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${badgeColor}`}>
                  {pct.toFixed(1)}% full
                </span>
              </div>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RevenueBreakdownChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No revenue data recorded for the selected criteria.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const studentRev = parseFloat(item.student_revenue || 0);
        const facultyRev = parseFloat(item.faculty_revenue || 0);
        const guestRev = parseFloat(item.guest_revenue || 0);
        const total = parseFloat(item.total_revenue || 0);

        const studentPct = total > 0 ? (studentRev / total) * 100 : 0;
        const facultyPct = total > 0 ? (facultyRev / total) * 100 : 0;
        const guestPct = total > 0 ? (guestRev / total) * 100 : 0;

        return (
          <div key={item.event_id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{item.event_title}</h4>
                <div className="text-xs text-slate-500">Total tickets sold: {item.total_tickets_sold}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900">
                  ₹{Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-medium text-emerald-600">Gross Event Revenue</div>
              </div>
            </div>

            {/* Stacked Percentage Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-3">
              {studentPct > 0 && (
                <div
                  title={`Student: ₹${studentRev} (${studentPct.toFixed(1)}%)`}
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${studentPct}%` }}
                />
              )}
              {facultyPct > 0 && (
                <div
                  title={`Faculty: ₹${facultyRev} (${facultyPct.toFixed(1)}%)`}
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${facultyPct}%` }}
                />
              )}
              {guestPct > 0 && (
                <div
                  title={`Guest: ₹${guestRev} (${guestPct.toFixed(1)}%)`}
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${guestPct}%` }}
                />
              )}
            </div>

            {/* Legend Tiers */}
            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Student:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{studentRev.toFixed(0)} ({item.student_tickets})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Faculty:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{facultyRev.toFixed(0)} ({item.faculty_tickets})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Guest:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{guestRev.toFixed(0)} ({item.guest_tickets})
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TopEventsRankingTable({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No ranked events available.
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => parseFloat(d.total_revenue || 0)), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const rev = parseFloat(item.total_revenue || 0);
        const relWidth = (rev / maxRevenue) * 100;

        let badge = null;
        if (item.revenue_rank === 1) {
          badge = <span className="text-amber-500 font-extrabold text-base">🥇 #1</span>;
        } else if (item.revenue_rank === 2) {
          badge = <span className="text-slate-400 font-extrabold text-base">🥈 #2</span>;
        } else if (item.revenue_rank === 3) {
          badge = <span className="text-amber-700 font-extrabold text-base">🥉 #3</span>;
        } else {
          badge = <span className="text-slate-500 font-semibold text-sm">#{item.revenue_rank}</span>;
        }

        return (
          <div key={item.event_id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 text-center shrink-0">{badge}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">{item.event_title}</h4>
                <div className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                  ₹{Number(rev).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>{item.hosting_club} • {item.event_type}</span>
                <span>{item.total_tickets_sold} tickets sold across {item.total_shows_held} shows</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(relWidth, 2)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
