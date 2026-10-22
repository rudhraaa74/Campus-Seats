// ─────────────────────────────────────────────────────────────
// frontend/src/hooks/useCountdown.js
// Custom React hook for live countdown timers synchronized with server timestamps
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

/**
 * Calculates remaining seconds until hold_expires_at and triggers callback upon expiration
 * @param {string|Date} targetExpiresAt Server expiration timestamp
 * @param {Function} onExpired Callback when timer hits 0
 */
export function useCountdown(targetExpiresAt, onExpired) {
  const calculateRemaining = () => {
    if (!targetExpiresAt) return 0;
    const expiryTime = new Date(targetExpiresAt).getTime();
    const now = Date.now();
    const difference = Math.max(0, Math.floor((expiryTime - now) / 1000));
    return difference;
  };

  const [secondsRemaining, setSecondsRemaining] = useState(calculateRemaining);

  useEffect(() => {
    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onExpired) onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetExpiresAt]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    secondsRemaining,
    formatted,
    isExpired: secondsRemaining <= 0,
    isUrgent: secondsRemaining > 0 && secondsRemaining <= 60,
    isWarning: secondsRemaining > 60 && secondsRemaining <= 120,
  };
}
