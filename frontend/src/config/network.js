function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

function normalizeBackendOrigin(value = '') {
  const trimmedValue = trimTrailingSlash(value.trim());
  return trimmedValue.replace(/\/api$/i, '');
}

const configuredApiUrl = normalizeBackendOrigin(import.meta.env.VITE_API_URL || '');
const configuredSocketUrl = trimTrailingSlash((import.meta.env.VITE_SOCKET_URL || '').trim());
const useSameOrigin =
  String(import.meta.env.VITE_USE_SAME_ORIGIN || '').toLowerCase() === 'true';
const sameOrigin =
  useSameOrigin && typeof window !== 'undefined' ? window.location.origin : '';
const localBackendOrigin = 'http://localhost:5050';
const fallbackBackendOrigin = import.meta.env.DEV
  ? sameOrigin || localBackendOrigin
  : sameOrigin;

if (import.meta.env.PROD && !configuredApiUrl && !sameOrigin) {
  throw new Error('VITE_API_URL is required for production deployments unless VITE_USE_SAME_ORIGIN=true.');
}

export const API_BASE_URL = configuredApiUrl || fallbackBackendOrigin;
export const SOCKET_URL = configuredSocketUrl || configuredApiUrl || fallbackBackendOrigin;

if (import.meta.env.PROD && !configuredSocketUrl) {
  console.warn('VITE_SOCKET_URL is not set. Falling back to VITE_API_URL for sockets.');
}
