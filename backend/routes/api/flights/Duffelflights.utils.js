// backend/routes/api/flights/Duffelflights.utils.js
// Turns Duffel offers into the SAME shape toFrontendFlightShape() gives
// LiteAPI flights, so flight cards, filters, XP badges, Atlas and the
// fare-refresh logic all work without knowing which supplier a fare is from.

const CABINS = {
  economy: "economy",
  premium: "premium_economy",
  premium_economy: "premium_economy",
  business: "business",
  first: "first",
};

// Skyrio's price on a Duffel fare. Skyrio is the merchant for Duffel fares
// (Stripe charges the traveler, Skyrio pays Duffel from its balance), so
// Stripe + Duffel fees come out of this margin. Set DUFFEL_MARKUP_PCT
// (e.g. 6 = 6%). Used for search, verify AND checkout, so the price shown
// is always the price charged.
export function duffelSellPrice(netAmount) {
  const net = Number(netAmount);
  if (!Number.isFinite(net)) return NaN;
  const pct = Math.max(0, Number(process.env.DUFFEL_MARKUP_PCT) || 0) / 100;
  return Math.round(net * (1 + pct) * 100) / 100;
}

export function buildDuffelSearchPayload({
  origin,
  destination,
  departureDate,
  returnDate,
  adults = 1,
  cabinClass = "economy",
}) {
  const slices = [{ origin, destination, departure_date: departureDate }];
  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }
  const adultCount = Math.min(9, Math.max(1, Number(adults) || 1));
  return {
    data: {
      slices,
      passengers: Array.from({ length: adultCount }, () => ({ type: "adult" })),
      cabin_class: CABINS[String(cabinClass || "economy").toLowerCase()] || "economy",
    },
  };
}

// "PT2H30M" / "P1DT1H5M" → minutes
export function isoDurationToMinutes(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(String(iso || ""));
  if (!m) return null;
  const [, d = 0, h = 0, min = 0] = m;
  return Number(d) * 1440 + Number(h) * 60 + Number(min);
}

function toSlice(slice = {}) {
  const segments = slice.segments || [];
  if (!segments.length) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    origin: first.origin?.iata_code,
    originName: first.origin?.name,
    destination: last.destination?.iata_code,
    destinationName: last.destination?.name,
    departureTime: first.departing_at,
    arrivalTime: last.arriving_at,
    stops: segments.length - 1,
    segments: segments.map((s) => ({
      origin: s.origin?.iata_code,
      destination: s.destination?.iata_code,
      departureTime: s.departing_at,
      arrivalTime: s.arriving_at,
      durationMinutes: isoDurationToMinutes(s.duration),
      carrier: s.marketing_carrier?.name,
      carrierCode: s.marketing_carrier?.iata_code,
      carrierLogo: s.marketing_carrier?.logo_symbol_url || null,
      flightNumber: s.marketing_carrier_flight_number,
      // Who actually flies it (US DOT: show this when it differs).
      operatingCarrier: s.operating_carrier?.name || null,
    })),
  };
}

export function duffelOfferToFrontendShape(offer = {}) {
  const slices = (offer.slices || []).map(toSlice).filter(Boolean);
  const outbound = slices[0] || {};
  const returnSlice = slices[1] || null;
  const firstSegment = outbound.segments?.[0] || {};
  const durations = (offer.slices || []).map((s) => isoDurationToMinutes(s.duration));
  const totalDurationMinutes = durations.every(Number.isFinite)
    ? durations.reduce((a, b) => a + b, 0)
    : null;

  return {
    id: offer.id,
    offerId: offer.id,
    provider: "duffel",
    owner: firstSegment.carrier || offer.owner?.name || "Unknown",
    ownerCode: firstSegment.carrierCode || offer.owner?.iata_code || "",
    ownerLogo: firstSegment.carrierLogo || offer.owner?.logo_symbol_url || null,
    totalAmount: duffelSellPrice(offer.total_amount),
    totalCurrency: offer.total_currency || "USD",
    origin: outbound.origin,
    destination: outbound.destination,
    departingAt: outbound.departureTime,
    arrivingAt: outbound.arrivalTime,
    returningAt: returnSlice?.departureTime || null,
    returnArrivingAt: returnSlice?.arrivalTime || null,
    stops: outbound.stops ?? 0,
    fareFamily: offer.slices?.[0]?.fare_brand_name || null,
    seatsRemaining: null,
    totalDurationMinutes,
    fareExpiresAt: offer.expires_at || null,
    slices,
    // Small on purpose (Duffel offers are large). Passenger ids are needed
    // later to create the Duffel order; conditions = refund/change rules.
    raw: {
      duffel: {
        offerId: offer.id,
        netAmount: Number(offer.total_amount),
        passengers: (offer.passengers || []).map((p) => ({ id: p.id, type: p.type })),
        conditions: offer.conditions || null,
        baseAmount: offer.base_amount ?? null,
        taxAmount: offer.tax_amount ?? null,
        liveMode: offer.live_mode ?? null,
      },
    },
  };
}

// Same physical journey across suppliers: carrier + flight number + local
// departure time of every segment. null if a segment is missing data.
export function journeyKey(f) {
  const segs = (f?.slices || []).flatMap((s) => s?.segments || []);
  if (!segs.length) return null;
  const parts = segs.map((s) => {
    const code = String(s?.carrierCode || "").toUpperCase();
    let num = String(s?.flightNumber || "").toUpperCase().replace(/\s/g, "");
    if (code && num.startsWith(code)) num = num.slice(code.length);
    num = num.replace(/^0+/, "");
    const dep = String(s?.departureTime || "").slice(0, 16);
    return code && num && dep ? `${code}${num}@${dep}` : null;
  });
  return parts.every(Boolean) ? parts.join("|") : null;
}

/**
 * One list from both suppliers. When both sell the same flights, the
 * cheaper fare wins; on a tie LiteAPI's stays (its checkout is proven).
 * Sorted cheapest first.
 */
export function mergeFlights(liteFlights = [], duffelFlights = []) {
  const byKey = new Map();
  const unkeyed = [];
  let replaced = 0;
  for (const f of [...liteFlights, ...duffelFlights]) {
    const key = journeyKey(f);
    if (!key) {
      unkeyed.push(f);
      continue;
    }
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, f);
    } else if (Number(f.totalAmount) < Number(prev.totalAmount) - 0.005) {
      byKey.set(key, f);
      replaced++;
    }
  }
  const merged = [...byKey.values(), ...unkeyed].sort(
    (a, b) => (Number(a.totalAmount) || Infinity) - (Number(b.totalAmount) || Infinity)
  );
  console.log(
    `[flights/search] merged LiteAPI ${liteFlights.length} + Duffel ${duffelFlights.length} → ${merged.length}` +
      (replaced ? ` (Duffel cheaper on ${replaced} shared flight(s))` : "")
  );
  return merged;
}
