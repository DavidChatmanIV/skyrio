// src/lib/guestKey.js
// A random per-browser key so a guest's Atlas checkout link only opens in the
// browser that created it. Send it on every API call (Atlas chat + checkout).

const STORAGE_KEY = "skyrio_guest_key";
let memoryKey = null; // fallback when localStorage is blocked (private mode etc.)

function makeKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getGuestKey() {
  try {
    let key = localStorage.getItem(STORAGE_KEY);
    if (!key) {
      key = makeKey();
      localStorage.setItem(STORAGE_KEY, key);
    }
    return key;
  } catch {
    if (!memoryKey) memoryKey = makeKey();
    return memoryKey;
  }
}

/** Merge the guest header into fetch options: fetch(apiUrl(p), withGuestHeader(opts)) */
export function withGuestHeader(init = {}) {
  return {
    ...init,
    headers: { ...(init.headers || {}), "X-Skyrio-Guest": getGuestKey() },
  };
}
