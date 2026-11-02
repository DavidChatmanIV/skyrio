// backend/middleware/guestKey.js
// Identifies a logged-out browser so a guest's Atlas search results only work
// for that same guest. The frontend makes a random key once (localStorage) and
// sends it as the X-Skyrio-Guest header. Only an HMAC of it is ever used.
//
// Never leaves a guest stranded. This used to return null (and Atlas said it
// "hit a snag pulling live prices, refresh") when:
//   1. GUEST_KEY_SECRET wasn't set on the server, or
//   2. the browser didn't send the header (private browsing, cleared
//      storage, an older cached page).
// Now:
//   1. With no GUEST_KEY_SECRET, a key derived from JWT_SECRET is used
//      (different from JWT_SECRET itself). Setting GUEST_KEY_SECRET on
//      Render is still best.
//   2. With no header, the guest is identified by IP + browser instead.
//      Weaker, but Atlas option ids are random and expire in ~13 minutes,
//      so it's only a fallback to keep live prices working.
import crypto from "crypto";

const HEADER = "x-skyrio-guest";
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
let warnedSecret = false;
let warnedHeader = false;

function guestSecret() {
  if (process.env.GUEST_KEY_SECRET) return process.env.GUEST_KEY_SECRET;
  if (!warnedSecret) {
    console.warn(
      "[guestKey] GUEST_KEY_SECRET is not set. Using a key derived from JWT_SECRET. Add GUEST_KEY_SECRET on Render when you can."
    );
    warnedSecret = true;
  }
  return `${process.env.JWT_SECRET || "skyrio-dev"}::guest-key`;
}

export function hashGuestKey(rawKey) {
  return crypto
    .createHmac("sha256", guestSecret())
    .update(String(rawKey))
    .digest("hex");
}

function clientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    "unknown"
  );
}

export function guestKey(req, _res, next) {
  const raw = req.get(HEADER);
  if (raw && KEY_PATTERN.test(raw)) {
    req.guestKeyHash = hashGuestKey(raw);
  } else {
    if (!warnedHeader) {
      console.warn(
        "[guestKey] a guest request came without the X-Skyrio-Guest header. Falling back to IP + browser."
      );
      warnedHeader = true;
    }
    req.guestKeyHash = hashGuestKey(
      `ipua:${clientIp(req)}|${String(req.get("user-agent") || "").slice(
        0,
        200
      )}`
    );
  }
  next();
}

export const GUEST_HEADER = HEADER;
