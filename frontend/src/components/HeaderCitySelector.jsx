import { useEffect, useMemo, useRef, useState } from "react";
import INDIA_CITIES from "../config/indiaCities.js";
import { useLocationSelection } from "../context/useLocationSelection.js";
import { fetchCurrentIpLocation } from "../utils/ipLocation.js";

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function HeaderCitySelector() {
  const {
    selectedLocation,
    selectedCity,
    setSelectedLocation,
    clearSelectedLocation,
  } = useLocationSelection();
  const [inputValue, setInputValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveLocationState, setLiveLocationState] = useState({
    status: "idle",
    message: "",
  });
  const rootRef = useRef(null);
  const matchingCities = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return [];

    return INDIA_CITIES.filter((city) => city.toLowerCase().includes(term)).slice(
      0,
      6,
    );
  }, [inputValue]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function submitInputValue(nextValue = inputValue) {
    const normalizedValue = String(nextValue || "").trim();
    if (!normalizedValue) return;

    setSelectedLocation({
      city: normalizedValue,
      label: normalizedValue,
      source: "manual",
    });
    setInputValue("");
    setMenuOpen(false);
    setLiveLocationState({ status: "idle", message: "" });
  }

  function submitBestMatch() {
    const nextValue =
      matchingCities.length === 1 ? matchingCities[0] : inputValue.trim();
    if (!nextValue) return;

    submitInputValue(nextValue);
  }

  async function detectLiveLocation() {
    setLiveLocationState({
      status: "detecting",
      message: "Detecting your current city...",
    });

    try {
      const data = await fetchCurrentIpLocation();
      const city = data.city || "";
      const region = data.region || "";
      const country = data.country || "";

      if (!city) {
        throw new Error("Unable to detect your current city.");
      }

      const detailParts = [city, region, country].filter(Boolean);
      const label = detailParts.join(", ");

      setSelectedLocation({
        city,
        label: label || city,
        source: "live",
      });
      setMenuOpen(false);
      setLiveLocationState({
        status: "success",
        message: label || city,
      });
    } catch (error) {
      setLiveLocationState({
        status: "error",
        message: error.message || "Unable to detect your current city.",
      });
    }
  }

  const currentCityText = selectedCity || "Select city";
  const currentCityHelper =
    liveLocationState.status === "detecting"
      ? "Detecting your current city from your IP address..."
      : liveLocationState.status === "error"
        ? liveLocationState.message
        : liveLocationState.status === "success"
          ? `Detected via IP: ${liveLocationState.message}`
          : selectedLocation?.source === "live"
            ? `Detected via IP: ${selectedLocation?.label || selectedCity}`
            : selectedCity
              ? "Selected city is active"
              : "Choose a city to browse";

  return (
    <div
      ref={rootRef}
      className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    >
      <div className="relative">
        <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white transition dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={submitBestMatch}
            className="flex h-12 w-12 items-center justify-center text-slate-400 transition hover:text-emerald-600 dark:hover:text-emerald-300"
            aria-label="Search city"
          >
            <SearchIcon />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setMenuOpen(false);
            }}
            onFocus={() => setMenuOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitBestMatch();
              }
            }}
            className="h-12 w-full border-none bg-transparent pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            placeholder="Search for Cities, Movies, Events and Activities"
            aria-label="Search for city"
          />

          {inputValue ? (
            <button
              type="button"
              onClick={() => setInputValue("")}
              className="mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <ClearIcon />
            </button>
          ) : null}
        </div>

        {inputValue && matchingCities.length > 0 ? (
          <div className="absolute left-0 top-[calc(100%+0.55rem)] z-40 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Matching Cities
            </div>
            <ul className="max-h-64 overflow-auto p-2">
              {matchingCities.map((city) => (
                <li key={city}>
                  <button
                    type="button"
                    onClick={() => submitInputValue(city)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="truncate">{city}</span>
                    <span className="text-xs text-slate-400">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((currentValue) => !currentValue)}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-4 text-sm font-medium text-slate-900 transition hover:bg-emerald-50/70 dark:text-white dark:hover:bg-slate-800 lg:min-w-[190px]"
          aria-expanded={menuOpen}
          aria-label="Select city"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                selectedLocation?.source === "live"
                  ? "animate-pulse bg-emerald-500"
                  : selectedCity
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
            <span className="truncate font-semibold">{currentCityText}</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            <ChevronIcon open={menuOpen} />
          </span>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.45rem)] z-30 w-full min-w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                Current City
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedLocation?.source === "live"
                      ? "animate-pulse bg-emerald-500"
                      : selectedCity
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {currentCityText}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {currentCityHelper}
              </p>
            </div>

            <div className="p-2">
              <button
                type="button"
                onClick={detectLiveLocation}
                disabled={liveLocationState.status === "detecting"}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <span className="text-emerald-500 dark:text-emerald-300">
                    <LocationIcon />
                  </span>
                  <span>
                    {liveLocationState.status === "detecting"
                      ? "Detecting location..."
                      : "Use current location"}
                  </span>
                </span>
              </button>

              {selectedCity ? (
                <button
                  type="button"
                  onClick={() => {
                    clearSelectedLocation();
                    setMenuOpen(false);
                    setLiveLocationState({ status: "idle", message: "" });
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>Clear selected city</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
