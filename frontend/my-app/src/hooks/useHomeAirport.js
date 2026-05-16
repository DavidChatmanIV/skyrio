import { useState, useCallback } from "react";

const STORAGE_KEY = "skyrio_home_airport";

const DEFAULT_AIRPORT = {
  code: "EWR",
  city: "Newark",
  name: "Newark Liberty International",
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AIRPORT;
    const parsed = JSON.parse(raw);
    if (parsed?.code && parsed?.city) return parsed;
    return DEFAULT_AIRPORT;
  } catch {
    return DEFAULT_AIRPORT;
  }
}

export function useHomeAirport() {
  const [homeAirport, setHomeAirportState] = useState(() => readStored());

  const setHomeAirport = useCallback((airport) => {
    if (!airport?.code) return;
    const next = {
      code: airport.code,
      city: airport.city || airport.code,
      name: airport.name || airport.city || airport.code,
    };
    setHomeAirportState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const clearHomeAirport = useCallback(() => {
    setHomeAirportState(DEFAULT_AIRPORT);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    homeAirport,
    setHomeAirport,
    clearHomeAirport,
    homeCode: homeAirport.code,
    homeCity: homeAirport.city,
    homeName: homeAirport.name,
    isDefault: homeAirport.code === DEFAULT_AIRPORT.code,
  };
}
