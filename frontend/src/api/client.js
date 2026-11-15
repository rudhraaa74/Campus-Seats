// ─────────────────────────────────────────────────────────────
// frontend/src/api/client.js
// Central API fetch client attaching JWT and normalizing errors
// ─────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/**
 * Retrieves the authentication token with per-tab session isolation.
 * Prefers sessionStorage so each browser tab can maintain its own authenticated user
 * (e.g., demonstrating concurrency / double-booking race conditions between two tabs).
 * Falls back to localStorage and clones into sessionStorage for the current tab.
 */
export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken) return sessionToken;

  const localToken = localStorage.getItem('token');
  if (localToken) {
    // Clone into this tab's sessionStorage to isolate it from other tabs
    try {
      sessionStorage.setItem('token', localToken);
    } catch {
      // Ignore if quota exceeded or storage disabled
    }
    return localToken;
  }

  return null;
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    sessionStorage.setItem('token', token);
    localStorage.setItem('token', token);
  }
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error?.message || `Request failed with status ${res.status}`);
      err.code = data.error?.code || 'UNKNOWN_ERROR';
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (err) {
    // If it's a network disconnection error
    if (!err.status && err.name === 'TypeError') {
      err.message = 'Unable to connect to the SeatSync API server. Please check your network or server.';
      err.code = 'NETWORK_ERROR';
    }
    throw err;
  }
}

async function downloadFile(endpoint, defaultFilename = 'download.csv') {
  const token = getAuthToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error?.message || `Download failed with status ${res.status}`);
      err.code = data.error?.code || 'UNKNOWN_ERROR';
      err.status = res.status;
      throw err;
    }

    const disposition = res.headers.get('content-disposition') || '';
    let filename = defaultFilename;
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1].trim();
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return { filename };
  } catch (err) {
    if (!err.status && err.name === 'TypeError') {
      err.message = 'Unable to connect to the SeatSync API server. Please check your network or server.';
      err.code = 'NETWORK_ERROR';
    }
    throw err;
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
  download: downloadFile,
};
