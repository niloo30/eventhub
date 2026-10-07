import { useEffect, useMemo, useState } from "react";
import LocationContext from "./locationContext.js";

const STORAGE_KEY = "event-manager:selected-location";

function sanitizeLocation(nextLocation) {
  if (!nextLocation || typeof nextLocation !== "object") return null;

  const city = String(nextLocation.city || "").trim();
  if (!city) return null;

  const label = String(nextLocation.label || city).trim() || city;
  const placeId = String(nextLocation.placeId || "").trim();
  const source = ["manual", "search", "live"].includes(nextLocation.source)
    ? nextLocation.source
    : "manual";
  const lat = Number(nextLocation.lat);
  const lng = Number(nextLocation.lng);

  return {
    city,
    label,
    placeId,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source,
    updatedAt:
      typeof nextLocation.updatedAt === "string" && nextLocation.updatedAt
        ? nextLocation.updatedAt
        : new Date().toISOString(),
  };
}

function readStoredLocation() {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return null;
    return sanitizeLocation(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

export function LocationProvider({ children }) {
  const [selectedLocation, setSelectedLocationState] = useState(() =>
    readStoredLocation(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!selectedLocation) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedLocation));
  }, [selectedLocation]);

  const value = useMemo(
    () => ({
      selectedLocation,
      selectedCity: selectedLocation?.city || "",
      setSelectedLocation(nextLocation) {
        setSelectedLocationState(sanitizeLocation(nextLocation));
      },
      clearSelectedLocation() {
        setSelectedLocationState(null);
      },
    }),
    [selectedLocation],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}
