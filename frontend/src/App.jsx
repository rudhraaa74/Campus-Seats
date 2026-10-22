// ─────────────────────────────────────────────────────────────
// frontend/src/App.jsx
// Main application component with router and global providers
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { Events } from './pages/Events.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public browsing routes */}
              <Route path="/" element={<Events />} />
              <Route path="/events" element={<Events />} />

              {/* Authentication routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected attendee routes */}
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-600">
                      My Bookings will be enabled in Phase 4 / Phase 5.
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
