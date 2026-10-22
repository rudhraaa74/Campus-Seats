// ─────────────────────────────────────────────────────────────
// frontend/src/components/Navbar.jsx
// Role-aware navigation header component
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Ticket, User, LogOut, Calendar, PlusCircle, BarChart3, TrendingUp } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isClubManager = user && user.clubIds && user.clubIds.length > 0;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-9 w-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-emerald-200">
                <Ticket className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Seat<span className="text-emerald-600">Sync</span>
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              <Link
                to="/events"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition"
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                Browse Events
              </Link>

              {user && (
                <Link
                  to="/my-bookings"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition"
                >
                  <Ticket className="w-4 h-4 mr-1.5" />
                  My Bookings
                </Link>
              )}

              {isClubManager && (
                <>
                  <Link
                    to="/organizer/dashboard"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 hover:text-purple-900 transition"
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    Manage Shows
                  </Link>
                  <Link
                    to="/organizer/reports"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 hover:text-purple-900 transition"
                  >
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Analytics & Reports
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right actions: User Profile or Auth Buttons */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-900">
                    {user.first_name} {user.last_name || ''}
                  </div>
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                    {user.user_type}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="inline-flex items-center p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-200 transition"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
