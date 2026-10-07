import { API_BASE_URL } from '../config/network.js';

const DIRECT_IP_API_ENDPOINT =
  "http://ip-api.com/json/?fields=status,message,city,region,regionName,country,query";

function normalizeLocationPayload(payload = {}) {
  return {
    city: String(payload.city || "").trim(),
    region: String(payload.regionName || payload.region || "").trim(),
    country: String(payload.country || "").trim(),
    ip: String(payload.ip || payload.query || "").trim(),
    source: String(payload.source || "ip-api").trim(),
  };
}

async function fetchDirectBrowserIpLocation() {
  const response = await fetch(DIRECT_IP_API_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch your current city right now.");
  }

  const data = await response.json();
  if (data.status && data.status !== "success") {
    throw new Error(data.message || "Unable to detect your current city.");
  }

  return normalizeLocationPayload(data);
}

export async function fetchCurrentIpLocation() {
  const backendEndpoint = `${API_BASE_URL}/api/location/current`;

  try {
    const response = await fetch(backendEndpoint, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ message: "Unable to detect your current city." }));
      throw new Error(errorPayload.message || "Unable to detect your current city.");
    }

    const data = await response.json();
    return normalizeLocationPayload(data);
  } catch (backendError) {
    if (typeof window !== "undefined" && window.location.protocol === "http:") {
      return fetchDirectBrowserIpLocation();
    }

    throw backendError;
  }
}
