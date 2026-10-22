// ─────────────────────────────────────────────────────────────
// frontend/src/components/ProtectedRoute.jsx
// Route wrapper requiring user authentication and optional roles
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles, requireClubManager }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isClubManager = Boolean(
    user && (
      (Array.isArray(user.clubIds) && user.clubIds.length > 0) ||
      (Array.isArray(user.clubs) && user.clubs.length > 0)
    )
  );

  if (requireClubManager && !isClubManager) {
    return <Navigate to="/events" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.user_type)) {
    return <Navigate to="/events" replace />;
  }

  return children;
}
