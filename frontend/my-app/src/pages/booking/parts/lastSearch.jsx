// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { readHomeAirport } from "@/lib/homeAirport";

export const LAST_SEARCH_KEY = "skyrio_last_search";
export const STAYS_KEEP_MS = 20 * 60 * 1000;
export const FARE_MARGIN_MS = 60 * 1000; // drop fares with under a minute left

export function saveLastSearch(entry) {
  try {
    sessionStorage.setItem(
      LAST_SEARCH_KEY,
      JSON.stringify({ ...entry, savedAt: Date.now() })
    );
  } catch {
    /* storage full or blocked: nothing kept, no harm */
  }
}

export function readLastSearch() {
  try {
    const s = JSON.parse(sessionStorage.getItem(LAST_SEARCH_KEY) || "null");
    if (!s || (s.tab !== "Flights" && s.tab !== "Stays")) return null;
    const now = Date.now();
    if (s.tab === "Flights") {
      const fresh = (s.results || []).filter((f) => {
        const t = Date.parse(f?.expiresAt || "");
        return Number.isFinite(t) && t - now > FARE_MARGIN_MS;
      });
      return { ...s, results: fresh };
    }
    const freshStays = now - (Number(s.savedAt) || 0) < STAYS_KEEP_MS;
    return { ...s, results: freshStays ? s.results || [] : [] };
  } catch {
    return null;
  }
}

// Home airport only for signed-in travelers; guests pick where they fly from.
export function signedInHome() {
  try {
    return window.localStorage.getItem("token") ? readHomeAirport() : null;
  } catch {
    return null;
  }
}
