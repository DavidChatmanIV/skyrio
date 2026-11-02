// backend/services/manageLink.js
// ─────────────────────────────────────────────────────────────
// "Manage or cancel" links for one booking — no account needed.
//
// Guests book without an account, so they couldn't reach the cancel
// screen. Every confirmation email (and the Find my booking page) now
// carries a link like:
//
//   https://www.myskyrio.com/manage-booking/<bookingId>?t=<token>
//
// The token names ONE booking and is signed with a key derived from
// JWT_SECRET (but different from it), so it can never be used as a login,
// and a login token can't be passed off as a manage link. Having the link
// means you received the booking's email, the same proof airlines use for
// "manage my booking".
//
// It lasts 400 days (long enough for trips booked far ahead). Cancelling
// still shows the real refund terms and needs a confirm tap first.
// ─────────────────────────────────────────────────────────────
import jwt from "jsonwebtoken";
import { APP_URL } from "./emailLayout.js";

const KEY = `${process.env.JWT_SECRET || "dev_secret"}::booking-manage`;
const PURPOSE = "booking_manage";
export const MANAGE_LINK_DAYS = 400;

export function mintManageToken(bookingId) {
  if (!bookingId) return null;
  return jwt.sign({ p: PURPOSE, b: String(bookingId) }, KEY, {
    expiresIn: `${MANAGE_LINK_DAYS}d`,
  });
}

// Returns the booking id the token is for, or null if bad/expired.
export function readManageToken(token) {
  try {
    const d = jwt.verify(String(token || ""), KEY);
    return d?.p === PURPOSE && d.b ? String(d.b) : null;
  } catch {
    return null;
  }
}

export function manageUrlFor(bookingId) {
  const token = mintManageToken(bookingId);
  if (!token) return null;
  return `${APP_URL}/manage-booking/${bookingId}?t=${encodeURIComponent(
    token
  )}`;
}
