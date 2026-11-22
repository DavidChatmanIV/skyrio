// ─────────────────────────────────────────────────────────────
// hotels.utils.js
// Shared helpers for the hotels API layer — mirrors flights.utils.js
// ─────────────────────────────────────────────────────────────

/**
 * Validate a date string is in YYYY-MM-DD format.
 * @param {string} date
 * @returns {boolean}
 */
export function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Build the occupancies array LiteAPI expects for a search.
 *
 * FIXED: LiteAPI's `occupancies` is an array with ONE ENTRY PER ROOM —
 * each entry describes that single room's adults (and optionally
 * children). There is no "rooms" field on an occupancy object; the
 * room count is simply how many objects are in the array. The
 * previous version of this function returned a single object like
 * `[{ adults, rooms }]`, which isn't a shape LiteAPI recognizes for
 * multi-room requests — it was silently being treated as one room
 * regardless of what "rooms" the user asked for, which is why
 * multi-room searches never actually returned multi-room pricing.
 *
 * This splits the requested total travelers as evenly as possible
 * across the requested number of rooms (e.g. 7 adults / 3 rooms →
 * [3, 2, 2]). Every room gets at least 1 adult.
 *
 * @param {number} adults - total travelers across all rooms
 * @param {number} [rooms=1] - number of rooms requested
 * @returns {Array<{adults: number}>}
 */
export function buildOccupancies(adults = 1, rooms = 1) {
  const roomCount = Math.max(1, Math.round(Number(rooms)) || 1);
  const totalAdults = Math.max(1, Math.round(Number(adults)) || 1);

  const base = Math.floor(totalAdults / roomCount);
  const extra = totalAdults % roomCount;

  const occupancies = [];
  for (let i = 0; i < roomCount; i++) {
    // Distribute the remainder across the first `extra` rooms so the
    // split is as even as possible, e.g. 7 adults / 3 rooms → 3,2,2.
    const roomAdults = base + (i < extra ? 1 : 0);
    occupancies.push({ adults: Math.max(1, roomAdults) });
  }
  return occupancies;
}

/**
 * Normalize LiteAPI's real /hotels/rates response into a flat
 * list the frontend can render — one entry per bookable OFFER.
 *
 * IMPORTANT: an "offer" is not always one room. When a search
 * requests multiple occupancies (multiple rooms), LiteAPI bundles
 * all of them into a SINGLE offerId — prebooking/booking that one
 * offerId books every room in the bundle together in one call. The
 * previous version of this function only kept `rates[0]`, silently
 * discarding every other room in a multi-room offer — that's why a
 * 3-room search still showed (and would have booked) only 1 room.
 *
 * This now keeps every rate in `rates`, and callers should treat
 * `rates.length` as the true room count for this offer.
 *
 * Confirmed against a real production response:
 * {
 *   data: [
 *     {
 *       hotelId, et,
 *       roomTypes: [
 *         {
 *           roomTypeId, offerId, supplier, supplierId,
 *           rates: [{ rateId, name, boardName, retailRate, cancellationPolicies, ... }],
 *           offerRetailRate: { amount, currency },
 *           rateType, paymentTypes
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * @param {object} hotelEntry  One entry from result.data
 * @returns {object[]} Flattened list of bookable offers for this hotel
 */
/**
 * The offer's price for every room in it. offerRetailRate should already be
 * the total, but if adding up each room's own price (one rate per room)
 * comes to more, that sum is the real price: an offer can't cost less than
 * its rooms. (Atlas showed $424.92 for 3 rooms x 3 nights, about $47 a room
 * a night, for a hotel that costs far more.)
 */
export function offerTotal(roomType = {}) {
  const offer = Number(roomType.offerRetailRate?.amount);
  const perRoom = new Map(); // occupancyNumber -> that room's price
  for (const r of roomType.rates || []) {
    const amt = Number(r?.retailRate?.total?.[0]?.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const k = r.occupancyNumber ?? perRoom.size + 1;
    if (!perRoom.has(k)) perRoom.set(k, amt); // first rate for each room
  }
  const sum = [...perRoom.values()].reduce((a, b) => a + b, 0);
  if (!Number.isFinite(offer) || offer <= 0) return sum > 0 ? Math.round(sum * 100) / 100 : null;
  if (sum > offer * 1.02) {
    console.warn(
      `[hotels] offer ${roomType.offerId}: offerRetailRate ${offer} < its rooms' prices ${sum.toFixed(2)}; using the rooms' total`
    );
    return Math.round(sum * 100) / 100;
  }
  return offer;
}

/** Rooms an offer covers: distinct occupancyNumbers, else one per rate. */
export function roomsCoveredBy(rates = []) {
  const occ = new Set(rates.map((r) => r?.occupancyNumber).filter((n) => n != null));
  return occ.size || rates.length || 1;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/**
 * A cancellation deadline as people read it. Uses the clock time written in
 * the supplier's string (no time-zone conversion); "Z"/UTC strings say UTC.
 * Midnight means the START of that day, so it's shown as 11:59 PM the day
 * before ("2026-12-29 00:00" → "Dec 28, 11:59 PM"). null if unreadable.
 */
export function deadlineLabel(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]00:?00)?/.exec(
    String(v || "").trim()
  );
  if (!m) return null;
  let d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  if (+m[4] === 0 && +m[5] === 0) d = new Date(d.getTime() - 60000);
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${h % 12 || 12}:${mm} ${h >= 12 ? "PM" : "AM"}${m[6] ? " UTC" : ""}`;
}

/** "16:00" or "04:00 PM" → "4:00 PM". Anything else → null (never guess). */
export function to12h(v) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(String(v || ""));
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap) {
    if (h < 1 || h > 12) return null;
    return `${h}:${m[2]} ${ap}`;
  }
  if (h > 23) return null;
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * Price split for a LiteAPI offer: the room price and the taxes & fees
 * already INCLUDED in the total (fees paid at the hotel are shown
 * separately by the checkout). Same shape as Duffel's stayInfo.breakdown.
 * null when LiteAPI lists no included taxes — nothing is estimated.
 */
export function liteBreakdown(roomType, total) {
  const currency = roomType?.offerRetailRate?.currency ?? "USD";
  let included = 0;
  for (const r of roomType?.rates ?? []) {
    for (const t of r?.retailRate?.taxesAndFees ?? []) {
      const n = Number(t?.amount);
      if (t?.included === true && Number.isFinite(n) && n > 0) included += n;
    }
  }
  const tot = Number(total);
  if (!(included > 0) || !Number.isFinite(tot) || included >= tot) return null;
  const round = (n) => Math.round(n * 100) / 100;
  return { base: round(tot - included), taxesAndFees: round(included), currency };
}

// Hotel text that asks for payment Skyrio already took (prepaid rates
// only). Hidden, with a clear "you've paid in full" note in its place.
const ALREADY_PAID_RE =
  /bank transfer|payment before arrival|prepayment is required|full prepayment|pay(ment)? (is )?required (before|prior to) arrival|credit card is charged the total cost|not guaranteed until full payment/i;
// Money the guest may still be asked for AT the hotel (deposits, cash).
const AT_HOTEL_RE = /deposit|\bcash\b|reimburs|resort fee|collected (at|by|upon)/i;

// Other booking sites named in supplier text ("cannot be guaranteed by
// Priceline") → neutral words, so guests aren't confused about who they
// booked with. The rule itself is unchanged.
const OTHER_SITES_RE =
  /\b(by|through|with|from|via|contact) (Priceline(\.com)?|Booking\.com|Expedia|Hotels\.com|Agoda|Hotelbeds|Travelocity|Orbitz)\b/gi;

const sentences = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .replace(OTHER_SITES_RE, (_, w) => `${w} the booking partner`)
    // Suppliers sometimes glue two sentences: "private host A damage deposit"
    .replace(/([a-z])\s+(A|The) ((?:damage|security|refundable|cash) deposit)/g, "$1. $2 $3")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Makes supplier rules honest and short for Skyrio's checkout:
 *  - drops a repeated title ("Guarantee Policy: Guarantee Policy: …")
 *  - hides sentences asking for payment Skyrio already collected
 *  - pulls deposits / cash / fees owed at the hotel into hotelCharges,
 *    so they can be shown next to the total instead of buried
 *  - drops rules left empty, and exact duplicates
 * Returns { conditions, hotelCharges, hidPaymentText }.
 */
export function cleanStayRules(conditions = []) {
  const out = [];
  const charges = [];
  const seen = new Set();
  let hidPaymentText = false;
  for (const c of Array.isArray(conditions) ? conditions : []) {
    const title = String(c?.title || "").trim() || null;
    let text = String(c?.text || "").trim();
    if (title) {
      const prefix = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i");
      while (prefix.test(text)) text = text.replace(prefix, "");
    }
    const kept = [];
    for (const sent of sentences(text)) {
      if (ALREADY_PAID_RE.test(sent)) {
        hidPaymentText = true;
        continue;
      }
      if (AT_HOTEL_RE.test(sent)) {
        if (!charges.includes(sent)) charges.push(sent);
        continue;
      }
      kept.push(sent);
    }
    const clean = kept.join(" ").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, text: clean });
  }
  // Most useful first: what to bring / know, then the rest.
  const rank = (c) => (/important|check-?in|photo/i.test(String(c.title || "")) ? 0 : 1);
  out.sort((a, b) => rank(a) - rank(b));
  return { conditions: out, hotelCharges: charges, hidPaymentText };
}

/**
 * LiteAPI /data/hotel → the same stayInfo shape Duffel rooms use, so the
 * checkout page and emails treat both suppliers the same way.
 * checkinCheckoutTimes: { checkin_start, checkin_end, checkout,
 *   instructions: [{ instruction }], special_instructions }
 */
export function liteStayInfoFromDetails(d = {}) {
  const t = d?.checkinCheckoutTimes || {};
  const special = String(t.special_instructions || "").trim();
  const conditions = [];
  for (const i of Array.isArray(t.instructions) ? t.instructions : []) {
    const text = String(i?.instruction || "").trim();
    if (text) conditions.push({ title: "Check-in", text });
  }
  const important = String(d?.hotelImportantInformation || "").trim();
  if (important) conditions.push({ title: "Important information", text: important });
  for (const p of Array.isArray(d?.policies) ? d.policies : []) {
    const text = String(p?.description || "").trim();
    if (text) conditions.push({ title: p?.name || null, text });
  }
  return {
    checkInAfter: to12h(t.checkin_start),
    checkInBefore: to12h(t.checkin_end),
    checkOutBefore: to12h(t.checkout),
    hotelPhone: String(d?.phone || "").trim() || null,
    hotelEmail: String(d?.email || "").trim() || null,
    // Hotels with no 24-hour desk put arrival / key steps here.
    keyCollection: special || null,
    ...cleanStayRules(conditions),
  };
}

export function normalizeHotelRate(hotelEntry) {
  const hotelId = hotelEntry.hotelId;
  const roomTypes = hotelEntry.roomTypes ?? [];

  return roomTypes.map((roomType) => {
    const rates = roomType.rates ?? [];
    const firstRate = rates[0] ?? {};

    return {
      hotelId,
      roomTypeId: roomType.roomTypeId,
      offerId: roomType.offerId,

      // Primary display fields still reflect the first rate, so
      // existing single-room cards/UI keep working unchanged.
      roomName: firstRate.name ?? "Unknown room",
      boardName: firstRate.boardName ?? "",
      refundableTag: firstRate.cancellationPolicies?.refundableTag ?? null,

      // NEW: the full set of rates in this offer — one per room when
      // this offer bundles multiple rooms (multi-occupancy search).
      // rates.length is the true room count for this offer; every
      // entry has its own `name` (room type) and `boardName`, which
      // can differ between rooms in the same bundled offer.
      rates: rates.map((r) => ({
        rateId: r.rateId,
        name: r.name ?? "Unknown room",
        boardName: r.boardName ?? "",
        refundableTag: r.cancellationPolicies?.refundableTag ?? null,
        occupancyNumber: r.occupancyNumber ?? null,
      })),
      // Rooms this offer's price covers: one per occupancy (room) it has a
      // rate for. An offer can come back with a rate for only the first
      // room even when 2 were asked for; its price is then for 1 room.
      roomCount: roomsCoveredBy(rates),

      // offerRetailRate is the TOTAL for the whole offer (all bundled
      // rooms combined), not per-room — this was already correct even
      // before this fix.
      totalAmount: offerTotal(roomType),
      totalCurrency: roomType.offerRetailRate?.currency ?? "USD",
      suggestedSellingPrice: roomType.suggestedSellingPrice?.amount ?? null,

      rateType: roomType.rateType ?? "standard",
      supplier: roomType.supplier ?? "",

      // Same shape as Duffel rooms. Hotel details (times, contact, rules)
      // are added by the checkout page from /api/hotels/details/:hotelId.
      stayInfo: { breakdown: liteBreakdown(roomType, offerTotal(roomType)) },

      raw: roomType,
    };
  });
}
