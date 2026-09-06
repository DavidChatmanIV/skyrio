// ---------------------------------------------------------------------
// Search payload
// ---------------------------------------------------------------------

export function buildLiteApiSearchPayload({
  origin,
  destination,
  departureDate,
  returnDate,
  adults = 1,
  children = 0,
  cabinClass = "economy",
  currency = "USD",
}) {
  // FIX (root cause of the "Return TBD" bug): LiteAPI's own API
  // playground (Search for flights — legs-based itinerary) shows each
  // leg requires an explicit "direction": "OUTBOUND" / "INBOUND" field.
  // We were never sending it. Journeys came back with only a single
  // OUTBOUND segment and nothing for the return leg — even though the
  // fare pricing (offerId, per-passenger pricing) clearly reflected a
  // round trip — because LiteAPI had no way to know a second, inbound
  // leg was being requested. Adding direction here is what actually
  // gets LiteAPI to return inbound segments; the frontend/backend
  // leg-splitting logic below was correct all along, it simply never
  // had inbound segments to split.
  const legs = [
    { origin, destination, date: departureDate, direction: "OUTBOUND" },
  ];

  if (returnDate) {
    legs.push({
      origin: destination,
      destination: origin,
      date: returnDate,
      direction: "INBOUND",
    });
  }

  return {
    legs,
    adults,
    children,
    cabinClass,
    currency,
  };
}

// ---------------------------------------------------------------------
// Response normalization
//
// LiteAPI's exact response envelope has changed shape on us before
// (wrapped in `data: [ { journeys } ]` vs a bare `{ journeys }`), so this
// is written defensively: try several known shapes, and if none match,
// log the raw top-level keys so the next debugging session has something
// concrete to go on instead of a silent empty array.
// ---------------------------------------------------------------------

function extractJourneys(data) {
  if (!data || typeof data !== "object") return [];

  // Shape A: { data: [ { journeys: [...] } ] }
  if (Array.isArray(data.data) && data.data[0]?.journeys) {
    return data.data[0].journeys;
  }

  // Shape B: { journeys: [...] }
  if (Array.isArray(data.journeys)) {
    return data.journeys;
  }

  // Shape C: { data: { journeys: [...] } }
  if (Array.isArray(data?.data?.journeys)) {
    return data.data.journeys;
  }

  // Shape D: bare array of journeys
  if (Array.isArray(data)) {
    return data;
  }

  console.warn(
    "[LiteAPI Flights] normalizeFlightSearchResponse: unrecognized response shape. Top-level keys:",
    Object.keys(data)
  );
  return [];
}

function buildSlice(segments = []) {
  if (!segments.length) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    origin: first.originCode,
    originName: first.originName,
    destination: last.destinationCode,
    destinationName: last.destinationName,
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
    stops: segments.length - 1,
    segments: segments.map((s) => ({
      origin: s.originCode,
      destination: s.destinationCode,
      departureTime: s.departureTime,
      arrivalTime: s.arrivalTime,
      durationMinutes: s.duration?.minutes,
      carrier: s.carrier?.marketingName,
      carrierCode: s.carrier?.marketingCode,
      carrierLogo: s.carrier?.marketingLogo,
      flightNumber: s.flight?.marketingNumber,
    })),
  };
}

// Splits a flat segment list into { outboundSegments, inboundSegments }.
//
// History of this function, kept here so the next person touching it
// doesn't reintroduce a bug we already found:
//
//   v1 relied on `s.direction === "OUTBOUND"/"INBOUND"`, which silently
//   returned two empty arrays whenever LiteAPI's segments don't carry
//   that exact field/casing — which is what was actually happening in
//   practice. Both slices came back null, a fallback dumped ALL
//   segments into a single slice, and the return leg's times never
//   made it into slices[1] — hence "Return TBD" on the frontend even
//   though the return leg data existed in LiteAPI's raw response.
//
//   v2 split on the requested destination/return-date instead — for a
//   round trip, the first segment whose originCode matches the search
//   destination marks the start of the return leg. This fixed the
//   common case but has a gap: open-jaw itineraries (return departs
//   from a different city than the outbound arrived at) never match
//   destCode, so splitIndex stays -1 and everything falls back into
//   outbound again — same symptom, different cause. It's also
//   vulnerable to LiteAPI using a different code (e.g. metro vs.
//   airport code) for the same place in different contexts.
//
//   v3 checks connection-chain continuity first: within one leg,
//   segment[i]'s destinationCode always equals segment[i+1]'s
//   originCode (that's what makes it a connection rather than two
//   separate flights). The outbound/return boundary is simply the
//   first place that chain breaks. This works for open-jaw trips too,
//   since it never depends on matching against the search params. The
//   v2 destination-match logic is kept as a secondary fallback for the
//   rare case where continuity checking is inconclusive (e.g. missing
//   codes on a segment).
//
//   ROOT CAUSE FOUND (current): none of v1–v3 were ever the real bug.
//   LiteAPI's search payload (see buildLiteApiSearchPayload above)
//   never included the required "direction" field on each leg, so
//   LiteAPI only ever returned a single OUTBOUND segment per journey —
//   there was no inbound segment for any of this splitting logic to
//   find. Confirmed directly via LiteAPI's own API playground, which
//   documents "direction": "OUTBOUND"/"INBOUND" as part of each leg
//   object. Now that the payload sends it correctly, Strategy 1 below
//   (trusting LiteAPI's own per-segment direction field) should handle
//   the normal case; v2/v3 remain as fallbacks for edge cases.
function splitSegmentsByLeg(segments, params) {
  // Strategy 1: trust LiteAPI's own direction field, if it's actually
  // populated correctly for this response.
  const outboundByDirection = segments.filter(
    (s) => s.direction === "OUTBOUND"
  );
  const inboundByDirection = segments.filter((s) => s.direction === "INBOUND");
  if (outboundByDirection.length && inboundByDirection.length) {
    return {
      outboundSegments: outboundByDirection,
      inboundSegments: inboundByDirection,
    };
  }

  // One-way search — no return leg to split out.
  if (!params?.returnDate) {
    return { outboundSegments: segments, inboundSegments: [] };
  }

  if (segments.length < 2) {
    return { outboundSegments: segments, inboundSegments: [] };
  }

  // Strategy 2 (primary): find where the connection chain breaks.
  // Inside one leg, segment[i].destinationCode always feeds
  // segment[i+1].originCode. The first index where that continuity
  // breaks is the outbound/return boundary — works for open-jaw trips
  // too, since the return doesn't need to depart from the outbound's
  // arrival city.
  let splitIndex = -1;
  for (let i = 0; i < segments.length - 1; i++) {
    const thisDest = (segments[i].destinationCode || "").toUpperCase();
    const nextOrigin = (segments[i + 1].originCode || "").toUpperCase();
    if (thisDest && nextOrigin && thisDest !== nextOrigin) {
      splitIndex = i + 1;
      break;
    }
  }

  // Strategy 3 (fallback): original destination-match approach, for
  // the rare case where continuity checking above is inconclusive
  // (e.g. a segment missing origin/destination codes entirely).
  if (splitIndex === -1) {
    const destCode = (params.destination || "").toUpperCase();
    splitIndex = segments.findIndex(
      (s) => (s.originCode || "").toUpperCase() === destCode
    );
  }

  // Couldn't find where the return leg starts by any method — better
  // to show a (wrong but visible) single combined slice than silently
  // drop half the segments.
  if (splitIndex <= 0) {
    return { outboundSegments: segments, inboundSegments: [] };
  }

  return {
    outboundSegments: segments.slice(0, splitIndex),
    inboundSegments: segments.slice(splitIndex),
  };
}

export function normalizeFlightOffer(journey = {}, searchParams = {}) {
  const offer = journey.cheapestOffer || journey.offers?.[0] || {};
  const display = offer.pricing?.display || offer.pricing || {};
  const segments = journey.segments || [];

  const { outboundSegments, inboundSegments } = splitSegmentsByLeg(
    segments,
    searchParams
  );

  const outbound = buildSlice(outboundSegments);
  const inbound = buildSlice(inboundSegments);
  const slices = [outbound, inbound].filter(Boolean);

  return {
    id: journey.journeyKey || journey.id,
    provider: "liteapi",
    offerId: offer.offerId || offer.id,
    isCheapest: !!journey.isCheapest,
    price: {
      amount: display.total ?? display.amount ?? offer.totalAmount,
      currency: display.currency ?? offer.currency ?? "USD",
      base: display.base,
      taxes: display.taxes,
      fees: display.fees,
    },
    fareFamily: offer.fare?.family,
    seatsRemaining: offer.fare?.seatsRemaining,
    totalDurationMinutes: journey.totalDuration?.minutes,
    slices,
    raw: journey,
  };
}

export function normalizeFlightSearchResponse(data = {}, searchParams = {}) {
  const journeys = extractJourneys(data);
  return journeys.map((journey) => normalizeFlightOffer(journey, searchParams));
}

/**
 * Flattens a normalized LiteAPI offer into the flat shape the frontend
 * expects: flight.owner, flight.totalAmount, flight.origin,
 * flight.departingAt, flight.stops, flight.id, etc.
 */
export function toFrontendFlightShape(offer = {}) {
  const outbound = offer.slices?.[0] || {};
  const returnSlice = offer.slices?.[1] || null;
  const firstSegment = outbound.segments?.[0] || {};

  return {
    id: offer.id,
    offerId: offer.offerId,
    provider: offer.provider,
    owner: firstSegment.carrier || "Unknown",
    ownerCode: firstSegment.carrierCode || "",
    ownerLogo: firstSegment.carrierLogo || null,
    totalAmount: offer.price?.amount ?? 0,
    totalCurrency: offer.price?.currency ?? "USD",
    origin: outbound.origin,
    destination: outbound.destination,
    departingAt: outbound.departureTime,
    arrivingAt: outbound.arrivalTime,
    returningAt: returnSlice?.departureTime || null,
    returnArrivingAt: returnSlice?.arrivalTime || null,
    stops: outbound.stops ?? 0,
    fareFamily: offer.fareFamily,
    seatsRemaining: offer.seatsRemaining,
    totalDurationMinutes: offer.totalDurationMinutes,
    slices: offer.slices,
    raw: offer.raw,
  };
}

// ---------------------------------------------------------------------
// Booking flow payloads — confirmed against LiteAPI's real endpoints
// ---------------------------------------------------------------------

export function buildVerifyPayload({ offerId }) {
  return { offerId };
}

export function buildPrebookPayload({
  offerId,
  contact = {},
  passengers = [],
  usePaymentSdk = true,
  includeCreditBalance = false,
  payment = { descriptorSuffix: "FLIGHT" },
}) {
  return {
    offerId,
    usePaymentSdk,
    includeCreditBalance,
    payment,
    contact,
    passengers,
  };
}

export function buildAttachServicesPayload({
  selectedServices = [],
  voucherCode,
}) {
  return {
    selectedServices,
    ...(voucherCode ? { voucherCode } : {}),
  };
}

export function buildCompleteBookingPayload({ prebookId, ...rest }) {
  return {
    prebookId,
    ...rest,
  };
}
