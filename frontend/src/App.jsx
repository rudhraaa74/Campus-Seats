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
import { ShowDetail } from './pages/ShowDetail.jsx';
import { Checkout } from './pages/Checkout.jsx';
import { MyBookings } from './pages/MyBookings.jsx';
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
              <Route path="/events/:id" element={<ShowDetail />} />
              <Route path="/shows/:id" element={<ShowDetail />} />

              {/* Authentication routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected attendee routes */}
              <Route
                path="/checkout/:id"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookings />
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
