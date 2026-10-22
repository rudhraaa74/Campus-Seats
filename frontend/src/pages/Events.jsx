// ─────────────────────────────────────────────────────────────
// frontend/src/pages/Events.jsx
// Event Browse landing page (Phase 2 placeholder & W1 destination)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Calendar, Ticket, User, Sparkles } from 'lucide-react';

export function Events() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg mb-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Phase 2 Milestone Reached: W1 Authentication Active
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {user ? user.first_name : 'Attendee'}!
          </h1>
          <p className="mt-3 text-emerald-100 text-sm sm:text-base leading-relaxed">
            You are logged in as a <span className="font-semibold text-white uppercase">{user ? user.user_type : 'GUEST'}</span>.
            {user?.user_type === 'STUDENT' && ' You have access to subsidized student ticket quotas.'}
            {user?.user_type === 'FACULTY' && ' You have access to reserved faculty rates.'}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Upcoming Events</h3>
          <p className="text-sm text-slate-600 mb-4">
            Full event listings, interactive auditorium seat maps, and search filters will activate in Phase 3.
          </p>
          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
            Phase 3 Next
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
            <Ticket className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Seat Booking & Holds</h3>
          <p className="text-sm text-slate-600 mb-4">
            Real-time 5-minute seat reservations with Redis timers and simulated payments will activate in Phase 4.
          </p>
          <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
            Phase 4 (W2)
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4">
            <User className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Authenticated Profile</h3>
          <p className="text-sm text-slate-600 mb-4">
            User ID: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{user?.user_id}</span><br />
            Email: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{user?.email}</span>
          </p>
          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
            W1 Verified
          </span>
        </div>
      </div>
    </div>
  );
}
