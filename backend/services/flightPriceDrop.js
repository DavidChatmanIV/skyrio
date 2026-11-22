// "Your flight got cheaper": after a flight is booked, Skyrio searches the
// same route and dates again. If the exact same flights now cost less AND
// the airline would refund the old ticket in full right now, the traveler
// can book the lower fare and Skyrio cancels the old ticket for them.
//
// Rules (so it never promises a saving someone can't get):
//   - Same flights: carrier + flight number + departure time of every leg
//     (journeyKey), same fare brand when both are known, same travelers.
//   - Fare only. Bookings with paid seats or bags aren't watched (those may
//     not be refunded and would have to be bought again).
//   - Full refund to the card, confirmed by the airline right now:
//       LiteAPI: the ticket can be voided, or the airline confirms a refund
//                of everything paid, to the original card.
//       Duffel:  Duffel's cancellation quote refunds the whole order to the
//                original payment.
//     Airline credit never counts.
//   - Not Sync Together group flights, and not within 3 days of departure.
//   - Nothing is booked or cancelled here. The traveler books; the server
//     cancels the old ticket only after the new one is confirmed, and only
//     if the full refund still applies at that moment.
import { minSavingFor } from "./stayPriceDrop.js";
import { flightCancelQuote, extractFlightBookingId } from "./liteapiBookings.js";
import { isDuffelOrderId, duffelGetOrder, duffelCancelQuote, duffelRefundTerms } from "./duffelOrders.js";
import { journeyKey } from "../routes/api/flights/Duffelflights.utils.js";

const MIN_LEAD_MS = 3 * 24 * 3600 * 1000;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const lower = (v) => String(v || "").trim().toLowerCase();
const unwrap = (d) => (d && typeof d === "object" && d.data ? d.data : d) || {};

function amountOf(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  if (typeof v === "object") {
    for (const k of ["amount", "value", "total"]) {
      const n = amountOf(v[k]);
      if (n != null) return n;
    }
  }
  return null;
}

export function flightSupplierId(b) {
  return b?.flight?.bookingId || b?.providerBookingIds?.[0] || extractFlightBookingId(b?.flight?.liteapi) || null;
}

/** Can this booking be watched at all? */
export function flightCanBeWatched(b, now = Date.now()) {
  if (!b || b.type !== "Flight" || b.status !== "confirmed") return false;
  if (b.syncGroup || b.flight?.groupId) return false;
  if (!b.flight?.journeyKey || !b.flight?.search) return false;
  if (b.flight?.extrasAmount !== 0) return false; // unknown (null) or paid extras
  if (String(b.totalCurrency || "USD").toUpperCase() !== "USD") return false;
  if (!(Number(b.totalAmount) > 0) || !flightSupplierId(b)) return false;
  const dep = Date.parse(b.flight?.departureAt || b.dates?.start || "");
  return Number.isFinite(dep) && dep - now > MIN_LEAD_MS;
}

/**
 * Would the airline refund the old ticket in full, to the card, right now?
 * → { ok: true, via: "void" | "refund" | "duffel", refund } or { ok: false, reason }
 * Throws if the airline can't be reached (callers retry later).
 */
export async function fullRefundNow(b, deps = {}) {
  const { liteQuote = flightCancelQuote, getOrder = duffelGetOrder, duffelQuote = duffelCancelQuote } = deps;
  const paid = Number(b.totalAmount ?? b.total) || 0;
  const id = flightSupplierId(b);
  if (!id || !(paid > 0)) return { ok: false, reason: "no_reference" };

  if (isDuffelOrderId(id)) {
    const order = await getOrder(id);
    const quote = await duffelQuote(id);
    const t = duffelRefundTerms(quote, { paid, net: Number(order?.total_amount) });
    return t.full && t.refundTo === "card"
      ? { ok: true, via: "duffel", refund: t.customerRefund }
      : { ok: false, reason: t.refundTo === "airline_credit" ? "airline_credit" : "partial_refund" };
  }

  const { data } = await liteQuote(id);
  const q = unwrap(data);
  if (q.isCancellable === false) return { ok: false, reason: "not_cancellable" };
  const dest = lower(q.destination);
  if (dest !== "original_payment") return { ok: false, reason: dest === "voucher" ? "airline_credit" : "refund_not_to_card" };
  if (q.isVoidable === true) return { ok: true, via: "void", refund: paid };
  const refund = amountOf(q.refund) ?? amountOf(q.refundAmount) ?? amountOf(q.refund_amount);
  if (lower(q.confidence) === "confirmed" && refund != null && refund >= paid - 0.01)
    return { ok: true, via: "refund", refund: round2(Math.min(refund, paid)) };
  return { ok: false, reason: "partial_refund" };
}

/** The cheapest result for the same flights, same fare brand (if known). */
export function cheapestSameFlights(b, flights) {
  const key = b?.flight?.journeyKey;
  const brand = lower(b?.flight?.fareFamily);
  let best = null;
  for (const f of flights || []) {
    if (!key || journeyKey(f) !== key) continue;
    if (brand && f.fareFamily && lower(f.fareFamily) !== brand) continue;
    const cabin = lower(b.flight?.search?.cabinClass);
    if (!cabin || (f.searchedCabin && lower(f.searchedCabin) !== cabin)) continue;
    if (String(f.totalCurrency || "USD").toUpperCase() !== "USD") continue;
    const price = Number(f.totalAmount);
    if (!(price > 0)) continue;
    if (!best || price < Number(best.totalAmount)) best = f;
  }
  return best;
}

async function defaultSearch(params) {
  const { runSearch } = await import("../routes/api/flights/Liteapiflights.controller.js");
  const { flights } = await runSearch(params, { fresh: true });
  return flights || [];
}

/**
 * Live check. → { ok: true, savings, currency, paid, now, flight, refundVia }
 *            or { ok: false, reason, message }
 */
export async function checkFlightPriceDrop(b, deps = {}) {
  const { now = Date.now(), search = defaultSearch, refundNow = fullRefundNow } = deps;
  const gone = (reason, message = "The lower fare isn't available anymore.") => ({ ok: false, reason, message });
  if (!flightCanBeWatched(b, now)) return gone("not_watchable", "This flight can't be checked for a lower fare.");
  const paid = round2(Number(b.totalAmount));
  const flights = await search(b.flight.search);
  const best = cheapestSameFlights(b, flights);
  if (!best) return gone("not_found");
  const nowPrice = round2(Number(best.totalAmount));
  const savings = round2(paid - nowPrice);
  if (savings < minSavingFor(paid)) return gone("not_lower");
  const r = await refundNow(b);
  if (!r.ok)
    return gone(
      r.reason,
      "The airline wouldn't refund your current ticket in full now, so switching wouldn't save you money."
    );
  return { ok: true, savings, currency: "USD", paid, now: nowPrice, flight: best, refundVia: r.via };
}

/**
 * After the new flight is booked: cancel the old one on the server.
 * Same account (or the old booking's email link), the same flights, and a
 * full refund confirmed by the airline at this moment. Otherwise the old
 * ticket is kept and the traveler is told.
 * Status: cancelled | pending (airline still confirming) | fee | not_allowed | retry
 */
export async function replaceOldFlight({ newBooking, oldBookingId, userId, manageToken, retry = false }, deps) {
  const { Booking, cancelBookingCore, readManageToken, refundNow = fullRefundNow } = deps;
  const save = async (old, result) => {
    const at = new Date();
    await Booking.updateOne({ _id: newBooking._id }, { $set: { replaces: { bookingId: String(oldBookingId), ...result, at } } });
    if (old) await Booking.updateOne({ _id: old._id }, { $set: { replacedBy: { bookingId: String(newBooking._id), ...result, at } } });
    return result;
  };
  const old = await Booking.findById(oldBookingId);
  if (!old) return save(null, { status: "not_allowed", message: "Old booking not found." });
  const mayManage =
    (retry && newBooking.replaces?.bookingId === String(old._id) && newBooking.replaces?.status === "retry") ||
    (userId && old.user && String(old.user) === String(userId)) ||
    (manageToken && readManageToken(manageToken) === String(old._id));
  const sameFlights =
    old.type === "Flight" &&
    newBooking.type === "Flight" &&
    old.flight?.journeyKey &&
    old.flight.journeyKey === newBooking.flight?.journeyKey &&
    (Number(old.travelers) || 1) === (Number(newBooking.travelers) || 1);
  if (!mayManage || !sameFlights || String(old._id) === String(newBooking._id))
    return save(old, { status: "not_allowed", message: "This booking can't be replaced automatically." });
  if (old.status === "cancelled") return save(old, { status: "cancelled", refund: old.refundAmount || 0 });
  if (old.status === "cancel_pending") return save(old, { status: "pending" });

  let r;
  try {
    r = await refundNow(old);
  } catch (e) {
    return save(old, { status: "retry", message: "Couldn't reach the airline. We'll try again." });
  }
  if (!r.ok)
    return save(old, {
      status: "fee",
      message: "The airline wouldn't refund the old ticket in full anymore, so it was kept.",
    });
  try {
    const c = await cancelBookingCore(old, { actor: "system", byUserId: "price-drop" });
    if (c.status === 202 || c.body?.pending) return save(old, { status: "pending", refund: r.refund });
    if (c.status >= 200 && c.status < 300 && c.body?.ok !== false)
      return save(old, { status: "cancelled", refund: Number(c.body?.customerRefund) || r.refund });
    return save(old, { status: "retry", message: c.body?.message || "The airline didn't accept the cancellation yet." });
  } catch (e) {
    return save(old, { status: "retry", message: e.message });
  }
}

/** Used by both flight checkouts right after a booking is saved. Never throws. */
export async function replaceAfterFlightBooking({ savedId, oldBookingId, userId, manageToken }) {
  if (!savedId || !oldBookingId) return null;
  try {
    const { default: Booking } = await import("../models/booking.js");
    const { cancelBookingCore } = await import("../routes/bookings.routes.js");
    const { readManageToken } = await import("./manageLink.js");
    const fresh = await Booking.findById(savedId);
    if (!fresh || fresh.status !== "confirmed") return null;
    return await replaceOldFlight(
      { newBooking: fresh, oldBookingId: String(oldBookingId), userId, manageToken },
      { Booking, cancelBookingCore, readManageToken }
    );
  } catch (e) {
    console.error("[flight price drop] replace failed — will retry:", e.message);
    try {
      const { default: Booking } = await import("../models/booking.js");
      await Booking.updateOne(
        { _id: savedId },
        { $set: { replaces: { bookingId: String(oldBookingId), status: "retry", message: e.message, at: new Date() } } }
      );
    } catch {
      /* logged above */
    }
    return { status: "retry", message: "We're finishing cancelling your old ticket." };
  }
}

/**
 * Before charging for a replacement: is it really cheaper than what was
 * paid? → null if fine, or a message to show (nothing charged).
 */
export async function replacementPriceProblem({ oldBookingId, newTotal }) {
  if (!oldBookingId) return null;
  const { default: Booking } = await import("../models/booking.js");
  const old = await Booking.findById(oldBookingId).select("totalAmount total status type").lean().catch(() => null);
  if (!old || old.type !== "Flight" || old.status !== "confirmed") return "Your current booking can't be replaced. Nothing was charged.";
  const paid = Number(old.totalAmount ?? old.total) || 0;
  if (!(Number(newTotal) < paid))
    return `The lower fare is gone: it's $${Number(newTotal).toFixed(2)} now, not less than you paid. Nothing was charged, and your booking stays as it is.`;
  return null;
}
