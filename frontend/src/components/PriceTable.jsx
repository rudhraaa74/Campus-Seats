// ─────────────────────────────────────────────────────────────
// frontend/src/components/PriceTable.jsx
// Pricing grid per seat category and attendee tier
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Tag, Sparkles } from 'lucide-react';

export function PriceTable({ prices = [], userType }) {
  if (!prices || prices.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
        No pricing tiers configured for this show.
      </div>
    );
  }

  const currentUserType = userType ? userType.toUpperCase() : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-base">Ticket Pricing Matrix</h3>
        </div>
        {currentUserType && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
            <Sparkles className="w-3 h-3" />
            Your Tier: {currentUserType}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th scope="col" className="px-5 py-3">Category</th>
              <th
                scope="col"
                className={`px-5 py-3 text-right ${
                  currentUserType === 'STUDENT' ? 'bg-emerald-100/60 text-emerald-900 font-bold' : ''
                }`}
              >
                Student
              </th>
              <th
                scope="col"
                className={`px-5 py-3 text-right ${
                  currentUserType === 'FACULTY' ? 'bg-emerald-100/60 text-emerald-900 font-bold' : ''
                }`}
              >
                Faculty
              </th>
              <th
                scope="col"
                className={`px-5 py-3 text-right ${
                  currentUserType === 'GUEST' ? 'bg-emerald-100/60 text-emerald-900 font-bold' : ''
                }`}
              >
                Guest
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {prices.map((tier) => (
              <tr key={tier.category_id || tier.category_name} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  {tier.category_name}
                </td>
                <td
                  className={`px-5 py-3.5 text-right font-medium ${
                    currentUserType === 'STUDENT'
                      ? 'bg-emerald-50/60 text-emerald-700 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  ₹{tier.student_price ?? '—'}
                </td>
                <td
                  className={`px-5 py-3.5 text-right font-medium ${
                    currentUserType === 'FACULTY'
                      ? 'bg-emerald-50/60 text-emerald-700 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  ₹{tier.faculty_price ?? '—'}
                </td>
                <td
                  className={`px-5 py-3.5 text-right font-medium ${
                    currentUserType === 'GUEST'
                      ? 'bg-emerald-50/60 text-emerald-700 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  ₹{tier.guest_price ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
