// src/lib/homeAirport.js
// One place for the traveler's home airport ("closest airport to me").
// Saved on the account (Digital Passport) so it follows them to every
// device, and mirrored in this browser so pages can read it instantly.
// The localStorage key matches what the Discover page already uses.

const KEY = "skyrio_home_airport";
const API = import.meta.env.VITE_API_URL || "";
export const HOME_AIRPORT_EVENT = "skyrio:home-airport";

const authHeaders = () => {
  try {
    const t = window.localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : null;
  } catch {
    return null;
  }
};

const normalize = (ap) => {
  if (!ap?.code) return null;
  const code = String(ap.code).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  const city = ap.city || ap.cityName || code;
  return { code, city, name: ap.name || city };
};

// Instant, synchronous read from this browser.
export function readHomeAirport() {
  try {
    return normalize(JSON.parse(window.localStorage.getItem(KEY) || "null"));
  } catch {
    return null;
  }
}

function storeLocally(ap) {
  const next = normalize(ap);
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
  try {
    window.dispatchEvent(new CustomEvent(HOME_AIRPORT_EVENT, { detail: next }));
  } catch {
    /* non-fatal */
  }
  return next;
}

// Mirror an airport the account already saved (e.g. from Edit Profile)
// into this browser, without another server call.
export function rememberHomeAirportLocally(ap) {
  return storeLocally(ap);
}

// What's saved on the account. Also refreshes this browser's copy.
// Returns { homeAirport, onAccount } — onAccount is false when logged out
// or the server can't be reached (then the browser copy is returned).
export async function fetchHomeAirport() {
  const headers = authHeaders();
  if (!headers) return { homeAirport: readHomeAirport(), onAccount: false };
  try {
    const res = await fetch(`${API}/api/users/me/home-airport`, { headers });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const ap = normalize(data.homeAirport);
    if (ap) storeLocally(ap);
    return { homeAirport: ap, onAccount: true };
  } catch {
    return { homeAirport: readHomeAirport(), onAccount: false };
  }
}

// Saves to this browser right away, then to the account.
// Returns { homeAirport, synced }.
export async function saveHomeAirport(ap) {
  const next = storeLocally(ap);
  if (!next) return { homeAirport: null, synced: false };
  const headers = authHeaders();
  if (!headers) return { homeAirport: next, synced: false };
  try {
    const res = await fetch(`${API}/api/users/me/home-airport`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    return { homeAirport: next, synced: res.ok };
  } catch {
    return { homeAirport: next, synced: false };
  }
}

export async function clearHomeAirport() {
  storeLocally(null);
  const headers = authHeaders();
  if (!headers) return;
  try {
    await fetch(`${API}/api/users/me/home-airport`, {
      method: "DELETE",
      headers,
    });
  } catch {
    /* non-fatal */
  }
}
