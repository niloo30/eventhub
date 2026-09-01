const API_BASE = import.meta.env.VITE_API_BASE || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : '/api'
);

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('eventhub_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}: Request failed`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password, role) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) }),
  getMe: () => request('/auth/me'),

  // Dashboard & Alerts
  getDashboardStats: () => request('/dashboard/stats'),
  getAlerts: () => request('/alerts'),
  dismissAlert: (id) => request(`/alerts/${id}/dismiss`, { method: 'PATCH' }),

  // Events
  getEvents: (includeArchived = false) => request(`/events?includeArchived=${includeArchived}`),
  getEventDetails: (id) => request(`/events/${id}`),
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleArchiveEvent: (id) => request(`/events/${id}/archive`, { method: 'PATCH' }),

  // Sessions
  getSessions: (eventId = '') => request(`/sessions${eventId ? `?eventId=${eventId}` : ''}`),
  getSessionDetails: (id) => request(`/sessions/${id}`),
  createSession: (data) => request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),

  // Registrations
  getRegistrations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/registrations?${query}`);
  },
  createRegistration: (data) => request('/registrations', { method: 'POST', body: JSON.stringify(data) }),
  updateRegistrationStatus: (id, newStatus, notes) => request(`/registrations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ newStatus, notes })
  }),
  getRegistrationHistory: (id) => request(`/registrations/${id}/history`),

  // Staff
  getStaff: () => request('/staff'),
  assignStaff: (userId, sessionId) => request('/staff/assign', { method: 'POST', body: JSON.stringify({ user_id: userId, session_id: sessionId }) }),
  unassignStaff: (userId, sessionId) => request('/staff/assign', { method: 'DELETE', body: JSON.stringify({ user_id: userId, session_id: sessionId }) }),
  getMySessions: () => request('/staff/my-sessions'),

  // Bulk
  importCsv: (sessionId, csvContent) => request(`/bulk/import/${sessionId}`, { method: 'POST', body: JSON.stringify({ csvContent }) }),
  exportCsvUrl: (sessionId) => `${API_BASE}/bulk/export/${sessionId}?token=${localStorage.getItem('eventhub_token')}`
};
