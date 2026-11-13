/**
 * Launch Traveler badge + one-time bonus XP.
 *
 * WHO EARNS IT: a traveler whose booking was MADE inside the launch window
 * (LAUNCH_TRAVELER_START → LAUNCH_TRAVELER_END) and who actually TAKES that
 * trip. One badge per account, never offered again after the window closes.
 *
 * ANTI-CHEAT (every check runs on the server, from the Booking record):
 *  - Real money only: sandbox/test bookings (LiteAPI sandbox key, Duffel test
 *    token, Stripe test key) never count, so beta test bookings can't earn it.
 *  - Real supplier booking: needs the airline/hotel booking id, a paid date
 *    and at least LAUNCH_TRAVELER_MIN_SPEND collected by Skyrio (so $0
 *    pay-at-pickup car rentals don't count).
 *  - Book-and-cancel can't earn it: the badge stays PENDING until the trip
 *    starts and the 24h hold is over. Cancelled, refunded or failed bookings
 *    reverse it before it ever unlocks.
 *  - Refunded or disputed later (chargeback) → badge and XP are taken back.
 *    A chargeback also blocks the account from earning it again.
 *  - One per account (XP ledger "once" rule + unique index), granted once per
 *    booking even if several checkout paths call it.
 *  - Booking time comes from the server (Booking.createdAt), never the browser.
 *  - Admin can revoke it and block an account (fraud) from the admin API.
 *  - The bonus is the same for everyone (no plan multiplier).
 *
 * OFF until both dates are set on Render, so nothing happens during beta.
 */

export const LAUNCH_TRAVELER = {
  name: "Launch Traveler",
  ruleKey: "LAUNCH_TRAVELER",
  xp: 100,
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** { start, end, configured, open } — end is inclusive through that whole day (UTC). */
export function launchTravelerWindow(now = new Date()) {
  const start = toDate(process.env.LAUNCH_TRAVELER_START);
  let end = toDate(process.env.LAUNCH_TRAVELER_END);
  // A date-only END ("2027-04-15") means the end of that day.
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(String(process.env.LAUNCH_TRAVELER_END).trim())) {
    end = new Date(end.getTime() + 864e5 - 1);
  }
  const configured = Boolean(start && end && end > start);
  return {
    start: configured ? start : null,
    end: configured ? end : null,
    configured,
    open: configured && now >= start && now <= end,
  };
}

export function launchTravelerMinSpend() {
  const n = Number(process.env.LAUNCH_TRAVELER_MIN_SPEND);
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

// Test-mode detection per supplier. A booking only counts when the
// integration it went through is live.
const isTestKey = {
  stripe: () => /^sk_test_/.test(process.env.STRIPE_SECRET_KEY || ""),
  duffel: () =>
    /^duffel_test_/.test(process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_API_KEY || ""),
  // Same switch the LiteAPI client uses: sandbox unless LITEAPI_ENV=production.
  liteapi: () =>
    String(process.env.LITEAPI_ENV || "sandbox").toLowerCase() !== "production",
};

export function isTestModeBooking(booking) {
  if (process.env.LAUNCH_TRAVELER_ALLOW_TEST === "true") return false; // local testing only
  const provider = String(booking?.provider || "").toLowerCase();
  const providerIds = (booking?.providerBookingIds || []).map(String);
  if (provider.includes("duffel") || providerIds.some((id) => /^(ord_|bok_)/.test(id)))
    return isTestKey.duffel();
  if (provider.includes("liteapi")) return isTestKey.liteapi();
  // Paid through Skyrio's own Stripe account.
  if (booking?.stripePaymentIntentId || booking?.paymentIntentId) return isTestKey.stripe();
  // Unknown supplier: don't count it.
  return true;
}

/**
 * Why a booking does or doesn't qualify. Returns null when it qualifies,
 * otherwise a short reason (for logs and the admin view).
 */
export function launchTravelerIneligibleReason(booking, user) {
  const win = launchTravelerWindow();
  if (!win.configured) return "program_off";
  if (!booking || booking.status !== "confirmed") return "not_confirmed";
  if (!booking.user) return "guest_booking";
  if (user?.launchTravelerBlocked) return "blocked";
  const madeAt = toDate(booking.createdAt);
  if (!madeAt || madeAt < win.start || madeAt > win.end) return "outside_window";
  if (!(booking.providerBookingIds || []).length) return "no_supplier_booking";
  if (!booking.paidAt && !booking.stripePaymentIntentId) return "not_paid";
  const paid = Number(booking.total ?? booking.totalAmount ?? 0);
  if (!(paid >= launchTravelerMinSpend())) return "below_min_spend";
  const refunded = Number(booking.refundAmount || 0);
  if (booking.refundStatus === "succeeded" && refunded >= paid) return "refunded";
  if (isTestModeBooking(booking)) return "test_mode";
  return null;
}
