// backend/middleware/guestKey.js
// Identifies a logged-out browser so a guest's Atlas search results only work
// for that same guest. The frontend makes a random key once (localStorage) and
// sends it as the X-Skyrio-Guest header. Only an HMAC of it is ever used.
import crypto from "crypto";

const HEADER = "x-skyrio-guest";
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
let warned = false;

export function hashGuestKey(rawKey) {
  const secret = process.env.GUEST_KEY_SECRET;
  if (!secret) {
    if (!warned) {
      console.warn("[guestKey] GUEST_KEY_SECRET is not set — guest Atlas booking is off.");
      warned = true;
    }
    return null;
  }
  return crypto.createHmac("sha256", secret).update(rawKey).digest("hex");
}

export function guestKey(req, _res, next) {
  const raw = req.get(HEADER);
  req.guestKeyHash = raw && KEY_PATTERN.test(raw) ? hashGuestKey(raw) : null;
  next();
}

export const GUEST_HEADER = HEADER;
