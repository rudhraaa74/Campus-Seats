// ─────────────────────────────────────────────────────────────
// frontend/src/components/CountdownTimer.jsx
// Visual countdown timer badge with color states (green -> amber -> red pulse)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown.js';

export function CountdownTimer({ expiresAt, onExpired }) {
  const { formatted, isExpired, isUrgent, isWarning } = useCountdown(expiresAt, onExpired);

  if (isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-100 text-red-800 text-xs font-bold border border-red-200">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <span>Hold Expired (00:00)</span>
      </div>
    );
  }

  let colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let clockClass = 'text-emerald-600';

  if (isUrgent) {
    colorClasses = 'bg-red-50 text-red-800 border-red-200 animate-pulse font-extrabold';
    clockClass = 'text-red-600';
  } else if (isWarning) {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    clockClass = 'text-amber-600';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-colors ${colorClasses}`}
    >
      <Clock className={`w-4 h-4 ${clockClass}`} />
      <span>
        Seats held for: <strong className="font-mono text-sm tracking-wide">{formatted}</strong>
      </span>
    </div>
  );
}
