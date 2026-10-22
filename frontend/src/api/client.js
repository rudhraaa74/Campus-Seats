// ─────────────────────────────────────────────────────────────
// frontend/src/api/client.js
// Central API fetch client attaching JWT and normalizing errors
// ─────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
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

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
};
