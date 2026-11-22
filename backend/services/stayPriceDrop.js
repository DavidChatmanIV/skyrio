// "Your stay got cheaper": after a stay is booked, Skyrio checks the same
// hotel, room, board and dates. If the same refundable room now costs less
// and the stay can still be cancelled for free, the traveler can book the
// lower price and then cancel the old booking for a full refund.
//
// Rules (so it never tells someone about a saving they can't get):
//   - LiteAPI stays only (Duffel Stays and shared Sync Together rooms are
//     skipped), confirmed, check-in in the future.
//   - The old booking is still free to cancel for at least FREE_CANCEL_BUFFER
//     (the hotel's own policy, read live from LiteAPI).
//   - The new price is for the same room name and board, refundable, same
//     guests per room, and it beats the old one by at least MIN_SAVING.
//   - Nothing is booked or cancelled here. The traveler confirms both steps.
import { liteapi } from "../routes/api/hotels/hotel.provider.js";
import { normalizeHotelRate } from "../routes/api/hotels/hotels.utils.js";
import { hotelGetBooking } from "./liteapiBookings.js";

export const MIN_SAVING = { dollars: 20, share: 0.05 }; // whichever is more
const FREE_CANCEL_BUFFER_MS = 24 * 3600 * 1000;

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const day = (v) => String(v || "").slice(0, 10);
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** The smallest saving worth telling someone about, for a stay that cost `paid`. */
export const minSavingFor = (paid) => Math.max(MIN_SAVING.dollars, round2(Number(paid || 0) * MIN_SAVING.share));

/**
 * Free cancellation until when, from the hotel's policy on the booking.
 * → Date, or null if it isn't free to cancel (non-refundable or a fee
 * already applies).
 */
export function freeCancelUntil(policy, now = Date.now()) {
  const cp = policy?.cancellationPolicies || {};
  if (cp.refundableTag === "NRFN") return null;
  const infos = (cp.cancelPolicyInfos || [])
    .map((p) => ({ at: Date.parse(p?.cancelTime || ""), fee: Number(p?.amount) || 0 }))
    .filter((p) => Number.isFinite(p.at))
    .sort((a, b) => a.at - b.at);
  // A fee that already applies → not free.
  if (infos.some((p) => p.at <= now && p.fee > 0)) return null;
  const next = infos.find((p) => p.at > now && p.fee > 0);
  return next ? new Date(next.at) : cp.refundableTag === "RFN" ? new Date(8.64e15) : null;
}

/** Which bookings this can work for (no API calls). */
export function stayCanBeWatched(b, now = Date.now()) {
  if (!b || b.type !== "Hotel" || b.status !== "confirmed") return false;
  if (b.sharedRoom || b.syncGroup) return false;
  if (b.provider === "duffel") return false;
  const rooms = b.hotelStay?.rooms || [];
  const conf = b.hotelStay?.confirmation || [];
  if (!rooms.length || rooms.length !== conf.length) return false;
  if (!rooms.every((r) => r.hotelId && r.roomName && r.checkin && r.checkout && Number(r.adults) > 0))
    return false;
  if (conf.some((c) => /^bok_/.test(String(c.bookingId || "")) || !c.bookingId)) return false;
  return Date.parse(day(rooms[0].checkin)) > now;
}

/** Cheapest refundable offer for the same room + board, for one room's guests. */
async function cheapestSameRoom(room, searchRates) {
  const res = await searchRates("/hotels/rates?rm=true", {
    method: "POST",
    body: {
      hotelIds: [room.hotelId],
      occupancies: [{ adults: Number(room.adults) }],
      guestNationality: "US",
      currency: room.totalCurrency || "USD",
      checkin: day(room.checkin),
      checkout: day(room.checkout),
      roomMapping: true,
      maxRatesPerHotel: 30,
    },
  });
  const offers = (res?.data ?? [])
    .flatMap(normalizeHotelRate)
    .filter(
      (o) =>
        o.offerId &&
        Number(o.totalAmount) > 0 &&
        same(o.roomName, room.roomName) &&
        same(o.boardName || "", room.boardName || "") &&
        o.refundableTag === "RFN" &&
        (o.roomCount || 1) === 1
    )
    .sort((a, b) => a.totalAmount - b.totalAmount);
  return offers[0] || null;
}

/**
 * Check one stay. Never throws.
 * → { ok: true, savings, currency, freeCancelUntil, rooms: [{ index, old, now, offer }] }
 *   or { ok: false, reason }
 * `offer` is the room object hotel checkout takes (fresh, to book now).
 */
export async function checkStayPriceDrop(
  b,
  {
    now = Date.now(),
    // Swappable for tests.
    getBooking = hotelGetBooking,
    searchRates = (path, opts) => liteapi.searchRequest(path, opts),
  } = {}
) {
  if (!stayCanBeWatched(b, now)) return { ok: false, reason: "not_eligible" };
  try {
    const rooms = b.hotelStay.rooms;
    const conf = b.hotelStay.confirmation;
    // 1. Still free to cancel the booking they have?
    let until = null;
    for (const c of conf) {
      const { data } = await getBooking(c.bookingId);
      const u = freeCancelUntil(data, now);
      if (!u || u.getTime() - now < FREE_CANCEL_BUFFER_MS) return { ok: false, reason: "not_free_to_cancel" };
      until = !until || u < until ? u : until;
    }
    // 2. Same room, today's price.
    const out = [];
    for (const [i, r] of rooms.entries()) {
      const offer = await cheapestSameRoom(r, searchRates);
      const old = Number(r.totalAmount);
      if (!offer || !Number.isFinite(old)) return { ok: false, reason: "no_same_room" };
      const { raw: _raw, ...rate } = offer;
      out.push({
        index: i,
        roomName: r.roomName,
        old: round2(old),
        now: round2(offer.totalAmount),
        offer: {
          ...rate,
          name: r.name,
          address: r.address || "",
          thumbnail: r.thumbnail || null,
          checkin: day(r.checkin),
          checkout: day(r.checkout),
          adults: Number(r.adults),
          totalAmount: round2(offer.totalAmount),
          totalCurrency: offer.totalCurrency || r.totalCurrency || "USD",
        },
      });
    }
    const savings = round2(out.reduce((s, x) => s + (x.old - x.now), 0));
    const paid = out.reduce((s, x) => s + x.old, 0);
    if (savings < minSavingFor(paid)) return { ok: false, reason: "no_real_saving", savings };
    return {
      ok: true,
      savings,
      currency: out[0].offer.totalCurrency,
      freeCancelUntil: until && until.getTime() < 8e15 ? until.toISOString() : null,
      rooms: out,
    };
  } catch (err) {
    console.warn("[stay price drop] check failed:", b?._id, err?.message);
    return { ok: false, reason: "check_failed" };
  }
}
