// backend/routes/api/flights/Duffelflights.seats.js
// Seat selection for Duffel fares (LiteAPI fares use prebook services).
//
//   GET  /api/flights/duffel/seats/:checkoutId
//        Duffel's seat maps for the held offer, in the same shape the
//        Skyrio seat map reads for LiteAPI ({ seatNumber, serviceId,
//        available, price, tier, segmentKey }).
//   POST /api/flights/duffel/seats/:checkoutId   { selected: [{ passengerIndex, serviceId }] }
//        Checks every pick against Duffel's live seat map, then sets the
//        card hold to fare + seats and remembers the seats so the order
//        includes them. Seats are charged at Duffel's price (no markup).
//
// Duffel gives each seat a separate service per passenger, so the
// serviceId Skyrio sends is "<segmentId>|<seat>" and the passenger's own
// Duffel service is looked up here.
import Stripe from "stripe";
import DuffelFlightCheckout from "../../../models/DuffelFlightCheckout.js";
import { duffelFlights, getDuffelOffer } from "./Duffelflights.provider.js";
import { readCheckoutToken, ownsCheckout, CHECKOUT_ENDED } from "../../../services/checkoutToken.js";

let _stripe;
const stripe = () => (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Seat type only when Duffel's own wording says so; otherwise free / paid. */
export function duffelSeatTier(el, price) {
  const words = `${el?.name || ""} ${(el?.disclosures || []).join(" ")}`;
  if (/exit/i.test(words)) return "exit-row";
  if (/leg ?room/i.test(words)) return "extra-legroom";
  return price > 0 ? "paid" : "standard";
}

/**
 * Duffel seat maps → Skyrio seat list, flights in itinerary order.
 * segmentOrder: segment ids in the order they're flown.
 */
export function duffelSeatMapsToSeats(seatMaps = [], segmentOrder = []) {
  const rank = (id) => {
    const i = segmentOrder.indexOf(id);
    return i < 0 ? 999 : i;
  };
  const maps = [...seatMaps].sort((a, b) => rank(a.segment_id) - rank(b.segment_id));
  const out = [];
  for (const m of maps) {
    for (const cabin of m.cabins || []) {
      for (const row of cabin.rows || []) {
        for (const section of row.sections || []) {
          for (const el of section.elements || []) {
            if (el?.type !== "seat" || !el.designator) continue;
            const services = (el.available_services || []).filter(
              (s) => String(s.total_currency || "USD").toUpperCase() === "USD"
            );
            const price = services.length ? Math.min(...services.map((s) => Number(s.total_amount) || 0)) : 0;
            out.push({
              seatNumber: String(el.designator),
              serviceId: `${m.segment_id}|${el.designator}`,
              available: services.length > 0,
              price: round2(price),
              tier: duffelSeatTier(el, price),
              segmentKey: m.segment_id,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Each pick → that passenger's own Duffel seat service.
 * → { services: [{ id, amount, seat, segmentId, passengerIndex }], total } or { error }
 */
export function resolveDuffelSeats(seatMaps = [], passengerIds = [], selected = []) {
  const bySeat = new Map();
  for (const m of seatMaps)
    for (const cabin of m.cabins || [])
      for (const row of cabin.rows || [])
        for (const section of row.sections || [])
          for (const el of section.elements || [])
            if (el?.type === "seat" && el.designator) bySeat.set(`${m.segment_id}|${el.designator}`, el);
  const services = [];
  const taken = new Set();
  for (const pick of selected) {
    const idx = Number(pick?.passengerIndex);
    const paxId = passengerIds[idx];
    const el = bySeat.get(String(pick?.serviceId || ""));
    const [segmentId, seat] = String(pick?.serviceId || "").split("|");
    if (!paxId || !el) return { error: "That seat isn't on this flight anymore. Pick another." };
    const svc = (el.available_services || []).find((s) => s.passenger_id === paxId);
    if (!svc) return { error: `Seat ${seat} isn't available for that traveler anymore. Pick another.` };
    if (String(svc.total_currency || "USD").toUpperCase() !== "USD")
      return { error: "That seat can't be paid in US dollars. Pick another." };
    const once = `${segmentId}|${idx}`;
    if (taken.has(once)) return { error: "Each traveler can have one seat per flight." };
    taken.add(once);
    services.push({ id: svc.id, amount: round2(svc.total_amount), seat, segmentId, passengerIndex: idx });
  }
  return { services, total: round2(services.reduce((s, x) => s + x.amount, 0)) };
}

async function loadOwned(req, res) {
  const { checkoutId } = req.params;
  const token = readCheckoutToken(req, "flight");
  if (!ownsCheckout(token, req, checkoutId)) {
    res.status(403).json(CHECKOUT_ENDED);
    return null;
  }
  const session = await DuffelFlightCheckout.findOne({ paymentIntentId: checkoutId }).catch(() => null);
  if (!session || session.status !== "PENDING") {
    res.status(409).json({ ok: false, message: "This checkout ended. Please start again." });
    return null;
  }
  return session;
}

async function seatMapsFor(offerId) {
  const { data } = await duffelFlights.get("/air/seat_maps", { params: { offer_id: offerId }, timeout: 30 * 1000 });
  return Array.isArray(data?.data) ? data.data : [];
}

async function segmentOrderFor(offerId) {
  const offer = await getDuffelOffer(offerId).catch(() => null);
  return (offer?.slices || []).flatMap((s) => (s.segments || []).map((g) => g.id));
}

export async function getDuffelSeats(req, res) {
  try {
    const session = await loadOwned(req, res);
    if (!session) return;
    const [maps, order] = await Promise.all([seatMapsFor(session.offerId), segmentOrderFor(session.offerId)]);
    const seats = duffelSeatMapsToSeats(maps, order);
    return res.json({ ok: true, seats, bags: [], serviceCategories: {} });
  } catch (err) {
    console.error("[duffel/seats] failed:", err?.response?.data?.errors?.[0] || err.message);
    // The page says seat selection isn't available; never invents seats.
    return res.json({ ok: false, seats: [], message: "Seat selection isn't available for this fare right now." });
  }
}

export async function saveDuffelSeats(req, res) {
  try {
    const session = await loadOwned(req, res);
    if (!session) return;
    const selected = Array.isArray(req.body?.selected) ? req.body.selected.slice(0, 40) : [];
    let services = [];
    let seatsTotal = 0;
    if (selected.length) {
      const maps = await seatMapsFor(session.offerId);
      const passengerIds = (session.orderPassengers || []).map((p) => p.id);
      const r = resolveDuffelSeats(maps, passengerIds, selected);
      if (r.error) return res.status(409).json({ ok: false, message: r.error });
      services = r.services;
      seatsTotal = r.total;
    }
    const total = round2(Number(session.sellAmount) + seatsTotal);
    // The card hold is updated before the traveler pays: fare + seats.
    await stripe().paymentIntents.update(session.paymentIntentId, { amount: Math.round(total * 100) });
    session.seatServices = services;
    session.seatsTotal = seatsTotal;
    session.markModified("seatServices");
    await session.save();
    return res.json({ ok: true, seatsTotal, total });
  } catch (err) {
    console.error("[duffel/seats save] failed:", err?.response?.data?.errors?.[0] || err.message);
    return res.status(502).json({ ok: false, message: "Couldn't reserve those seats. Pick others or skip." });
  }
}
