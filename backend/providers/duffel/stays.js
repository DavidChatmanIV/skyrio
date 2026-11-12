// backend/providers/duffel/stays.js
// Duffel Stays: a second hotel supplier next to LiteAPI.
//
// OFF unless DUFFEL_STAYS_ENABLED=true AND DUFFEL_ACCESS_TOKEN is set.
// While off, nothing here is called and hotels work exactly as before.
//
// How it plugs in (nothing else changes for the traveler):
//   search   → Duffel results come back in the SAME shape as LiteAPI rates
//              (hotels.utils.js normalizeHotelRate), tagged provider "duffel".
//              offerId is Duffel's rate id ("rat_…").
//   checkout → "rat_" offers get a Duffel quote instead of a LiteAPI prebook;
//              the quote id ("quo_…") travels as the prebookId.
//   book     → "quo_" prebooks are booked with Duffel, paid from the Duffel
//              balance (Skyrio already holds the traveler's card in Stripe).
//   manage   → Duffel booking ids ("bok_…") are looked up / cancelled here,
//              returned in the shape the LiteAPI hotel code already reads.
//
// Duffel docs: POST /stays/search · POST /stays/search_results/{id}/actions/fetch_all_rates
//              POST /stays/quotes · POST /stays/bookings · GET /stays/bookings/{id}
//              POST /stays/bookings/{id}/actions/cancel   (Duffel-Version: v2)

import axios from "axios";

const BASE_URL = "https://api.duffel.com";
// Hotels to price per search. Each one is a fetch_all_rates call.
const MAX_HOTELS = 8;
const RATES_PER_HOTEL = 3;
const SEARCH_RADIUS_KM = 10;

export function duffelStaysEnabled() {
  return (
    /^(true|1|yes|on)$/i.test(String(process.env.DUFFEL_STAYS_ENABLED ?? "").replace(/["'\s]/g, "")) &&
    Boolean(process.env.DUFFEL_ACCESS_TOKEN)
  );
}

export const isDuffelRateId = (id) => /^rat_/.test(String(id || ""));
export const isDuffelQuoteId = (id) => /^quo_/.test(String(id || ""));
export const isDuffelStayBookingId = (id) => /^bok_/.test(String(id || ""));

const duffel = axios.create({
  baseURL: BASE_URL,
  timeout: 30 * 1000,
  headers: {
    "Duffel-Version": "v2",
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  },
});
// Token read per request, so a missing token never crashes the server.
duffel.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`;
  return config;
});
// Log Duffel's real error, and throw an Error the hotel code can read
// (err.status, err.message), like the LiteAPI client does.
duffel.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const first = err.response?.data?.errors?.[0] || {};
    console.error(
      `[Duffel Stays] ${err.config?.method?.toUpperCase()} ${err.config?.url} -> ${
        status || "no response"
      }`,
      JSON.stringify({ code: first.code, title: first.title, message: first.message || err.message })
    );
    const e = new Error(first.message || first.title || err.message || "Duffel Stays request failed");
    e.status = status;
    e.code = first.code;
    e.details = err.response?.data;
    return Promise.reject(e);
  }
);

if (process.env.DUFFEL_ACCESS_TOKEN) {
  console.log(
    `[Duffel Stays] ${
      duffelStaysEnabled()
        ? "ON"
        : `OFF (set DUFFEL_STAYS_ENABLED=true; it's ${JSON.stringify(
            process.env.DUFFEL_STAYS_ENABLED ?? null
          )} now)`
    }`
  );
}

/* ───────────── Shapes ───────────── */

const BOARD = {
  room_only: "Room only",
  breakfast: "Breakfast included",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All inclusive",
};

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Duffel's cancellation_timeline ([{ before, refund_amount, currency }]:
 * cancel before `before` → get refund_amount back) turned into LiteAPI's
 * cancellationPolicies ({ refundableTag, cancelPolicyInfos: [{ cancelTime,
 * amount = fee once cancelTime has passed }] }), which the checkout page
 * and the cancel flow already read.
 * Refundable ("RFN") only when a FULL refund is still possible, so we
 * never promise more than Duffel gives back.
 */
export function duffelCancellationPolicies(timeline, total, currency = "USD") {
  const steps = (Array.isArray(timeline) ? timeline : [])
    .map((t) => ({ before: t.before, refund: money(t.refund_amount) }))
    .filter((t) => t.before && Number.isFinite(t.refund))
    .sort((a, b) => new Date(a.before) - new Date(b.before));
  const now = Date.now();
  const open = steps.filter((s) => new Date(s.before).getTime() > now);
  const fullRefundNow = open.length > 0 && open[0].refund >= total - 0.01;
  const infos = open.map((s, i) => {
    const next = open[i + 1];
    const fee = next ? total - next.refund : total;
    return {
      cancelTime: s.before,
      amount: Math.max(0, Math.round(fee * 100) / 100),
      currency,
    };
  });
  return {
    refundableTag: fullRefundNow ? "RFN" : "NRFN",
    cancelPolicyInfos: fullRefundNow ? infos : [],
  };
}

function addressOf(acc) {
  const a = acc?.location?.address || {};
  return [a.line_one, a.city_name, a.region, a.postal_code]
    .filter(Boolean)
    .join(", ");
}

/** One Duffel rate → one LiteAPI-shaped Stays result. */
function rateToStaysShape(acc, room, rate, { rooms, checkin, checkout }) {
  const total = money(rate.total_amount);
  const currency = rate.total_currency || "USD";
  const policies = duffelCancellationPolicies(rate.cancellation_timeline, total, currency);
  const boardName = BOARD[rate.board_type] || "";
  return {
    hotelId: acc.id,
    roomTypeId: room.id || null,
    offerId: rate.id,
    roomName: room.name || "Room",
    boardName,
    refundableTag: policies.refundableTag,
    cancellationPolicies: policies,
    rates: [
      { rateId: rate.id, name: room.name || "Room", boardName, refundableTag: policies.refundableTag },
    ],
    roomCount: rooms,
    // Duffel's rate total covers every room asked for, for the whole stay.
    totalAmount: total,
    totalCurrency: currency,
    suggestedSellingPrice: null,
    rateType: "standard",
    supplier: "duffel",
    provider: "duffel",
    // Card details Book → Stays shows (LiteAPI gets these from /data/hotels).
    name: acc.name || "Hotel",
    thumbnail: acc.photos?.[0]?.url || null,
    stars: acc.rating ?? null,
    rating: acc.review_score ?? null,
    address: addressOf(acc),
    latitude: acc.location?.geographic_coordinates?.latitude ?? null,
    longitude: acc.location?.geographic_coordinates?.longitude ?? null,
    checkin,
    checkout,
  };
}

/* ───────────── Search ───────────── */

/**
 * Hotels around a point, priced for every room and night.
 * @returns {Promise<object[]>} LiteAPI-shaped results, cheapest first.
 */
export async function searchDuffelStays({
  latitude,
  longitude,
  checkin,
  checkout,
  adults = 1,
  rooms = 1,
  radiusKm = SEARCH_RADIUS_KM,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!duffelStaysEnabled() || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const roomCount = Math.max(1, Math.round(Number(rooms)) || 1);
  const adultCount = Math.max(roomCount, Math.round(Number(adults)) || 1);

  const { data: search } = await duffel.post("/stays/search", {
    data: {
      rooms: roomCount,
      guests: Array.from({ length: adultCount }, () => ({ type: "adult" })),
      check_in_date: checkin,
      check_out_date: checkout,
      location: {
        radius: radiusKm,
        geographic_coordinates: { latitude: lat, longitude: lng },
      },
    },
  });
  const results = (search?.data?.results || [])
    .filter((r) => r?.id && r?.accommodation)
    .sort((a, b) => money(a.cheapest_rate_total_amount) - money(b.cheapest_rate_total_amount))
    .slice(0, MAX_HOTELS);

  // All rooms and rates for each hotel, in parallel. One hotel failing
  // never drops the others.
  const full = await Promise.allSettled(
    results.map((r) =>
      duffel
        .post(`/stays/search_results/${encodeURIComponent(r.id)}/actions/fetch_all_rates`)
        .then((res) => res.data?.data)
    )
  );

  const ctx = { rooms: roomCount, checkin, checkout };
  const out = [];
  for (const settled of full) {
    if (settled.status !== "fulfilled" || !settled.value?.accommodation) continue;
    const acc = settled.value.accommodation;
    const offers = [];
    for (const room of acc.rooms || []) {
      for (const rate of room.rates || []) {
        // Skyrio charges the full price at checkout, so only rates paid
        // now, with nothing extra owed at the hotel (no surprise fees).
        if (rate.payment_type && rate.payment_type !== "pay_now") continue;
        if (money(rate.due_at_accommodation_amount) > 0) continue;
        if (!rate.id || !Number.isFinite(money(rate.total_amount))) continue;
        offers.push(rateToStaysShape(acc, room, rate, ctx));
      }
    }
    offers.sort((a, b) => a.totalAmount - b.totalAmount);
    out.push(...offers.slice(0, RATES_PER_HOTEL));
  }
  console.info("[Duffel Stays] search", {
    checkin,
    checkout,
    rooms: roomCount,
    adults: adultCount,
    hotels: results.length,
    offers: out.length,
  });
  return out.sort((a, b) => a.totalAmount - b.totalAmount);
}

/* ───────────── Quote (Duffel's "prebook") ───────────── */

/** Locks a rate. Returns the same fields the LiteAPI prebook gives the checkout. */
export async function quoteDuffelRate(rateId) {
  const { data } = await duffel.post("/stays/quotes", { data: { rate_id: rateId } });
  const q = data?.data || {};
  const total = money(q.total_amount);
  if (!q.id || !Number.isFinite(total)) {
    const e = new Error("Duffel quote missing id or price");
    e.details = data;
    throw e;
  }
  return { prebookId: q.id, totalPrice: total, currency: q.total_currency || "USD", raw: q };
}

/* ───────────── Book ───────────── */

/** "+1 (973) 555-0100" / "9735550100" → "+19735550100" (Duffel needs E.164). */
export function toE164(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`; // US/Canada
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Books a quote. Returns { data: { bookingId, hotelConfirmationCode, status } }
 * — the shape finalizeHotelBookings() results already use.
 * No `payment` field: Duffel takes it from the Skyrio balance.
 */
export async function bookDuffelQuote({ quoteId, holder, guests }) {
  const phone = toE164(holder?.phone);
  if (!phone) {
    const e = new Error("A phone number is needed for this hotel.");
    e.status = 400;
    throw e;
  }
  const people = (Array.isArray(guests) && guests.length ? guests : [holder]).map((g) => ({
    given_name: g.firstName,
    family_name: g.lastName,
  }));
  const remarks = (guests || []).map((g) => g?.remarks).filter(Boolean).join(" ");
  const { data } = await duffel.post("/stays/bookings", {
    data: {
      quote_id: quoteId,
      guests: people,
      email: holder.email,
      phone_number: phone,
      ...(remarks ? { accommodation_special_requests: remarks.slice(0, 500) } : {}),
    },
  });
  const b = data?.data || {};
  return {
    data: {
      bookingId: b.id,
      hotelConfirmationCode: b.reference || null,
      status: b.status === "confirmed" ? "CONFIRMED" : String(b.status || "").toUpperCase(),
      provider: "duffel",
    },
    raw: b,
  };
}

/* ───────────── Manage (look up, cancel) ───────────── */

function bookingTotal(b) {
  const rate = b?.accommodation?.rooms?.[0]?.rates?.[0] || {};
  return { total: money(rate.total_amount), currency: rate.total_currency || "USD", rate };
}

/** GET a booking in the shape liteapiBookings.hotelGetBooking returns. */
export async function getDuffelStayBooking(bookingId) {
  const { data, status } = await duffel.get(`/stays/bookings/${encodeURIComponent(bookingId)}`);
  const b = data?.data || {};
  const { total, currency, rate } = bookingTotal(b);
  return {
    httpStatus: status,
    data: {
      bookingId: b.id,
      status: String(b.status || "").toUpperCase(),
      hotelConfirmationCode: b.reference || null,
      currency,
      price: total,
      cancellationPolicies: duffelCancellationPolicies(rate.cancellation_timeline, total, currency),
      provider: "duffel",
    },
    raw: data,
  };
}

/** What Duffel gives back if cancelled right now (first timeline step still open). */
export function refundNow(timeline) {
  const now = Date.now();
  const step = (Array.isArray(timeline) ? timeline : [])
    .filter((t) => t?.before && new Date(t.before).getTime() > now)
    .sort((x, y) => new Date(x.before) - new Date(y.before))[0];
  const n = money(step?.refund_amount);
  return Number.isFinite(n) ? n : 0;
}

/** Cancels, returning refund_amount the way the cancel flow reads it. */
export async function cancelDuffelStayBooking(bookingId) {
  // Worked out BEFORE cancelling, from Duffel's own timeline.
  let refund = null;
  try {
    const { data } = await duffel.get(`/stays/bookings/${encodeURIComponent(bookingId)}`);
    refund = refundNow(bookingTotal(data?.data).rate.cancellation_timeline);
  } catch {
    /* unknown: leave it out so the cancel flow uses its own estimate */
  }
  const { data, status } = await duffel.post(
    `/stays/bookings/${encodeURIComponent(bookingId)}/actions/cancel`
  );
  const b = data?.data || {};
  return {
    httpStatus: status,
    data: {
      bookingId: b.id || bookingId,
      status: String(b.status || "cancelled").toUpperCase(),
      ...(refund != null ? { refund_amount: Math.round(refund * 100) / 100 } : {}),
      provider: "duffel",
    },
    raw: data,
  };
}
