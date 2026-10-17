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
    // Surfaced so the frontend can show a "price locked for N:NN"
    // countdown — previously captured by LiteAPI but never passed
    // through, so nobody could see a fare go stale before hitting
    // /flights/verify at prebook time with no warning.
    expiresAt: offer.expiration || null,
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

// ---------------------------------------------------------------------
// Test-airline filter
//
// LiteAPI's sandbox mixes its own fake carrier ("Nuitée Air") into search
// results. Those fares fail at the reservation step, so a tester picks a
// flight, fills in their details, and hits "couldn't reserve this fare".
// Hide any journey where ANY segment is flown by a test carrier.
//
// On by default. Set HIDE_TEST_CARRIERS=false on Render to show them again
// (e.g. if LiteAPI support asks you to test against Nuitée Air on purpose).
// If a search returns ONLY test fares, they're kept rather than showing an
// empty result, and a warning is logged.
// ---------------------------------------------------------------------
const TEST_CARRIER_RE = /nuit[eé]e/i;

function isTestCarrierJourney(journey = {}) {
  return (journey.segments || []).some((s) => {
    const c = s?.carrier || {};
    return [c.marketingName, c.operatingName, c.name]
      .filter(Boolean)
      .some((n) => TEST_CARRIER_RE.test(n));
  });
}

function hideTestCarriers(journeys) {
  if (String(process.env.HIDE_TEST_CARRIERS).toLowerCase() === "false") {
    return journeys;
  }
  const real = journeys.filter((j) => !isTestCarrierJourney(j));
  const hidden = journeys.length - real.length;
  if (hidden && real.length) {
    console.info(`[LiteAPI Flights] hid ${hidden} test-airline fare(s)`);
    return real;
  }
  if (hidden && !real.length) {
    console.warn(
      "[LiteAPI Flights] search returned only test-airline fares; showing them so results aren't empty"
    );
  }
  return journeys;
}

export function normalizeFlightSearchResponse(data = {}, searchParams = {}) {
  const journeys = hideTestCarriers(extractJourneys(data));
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
    fareExpiresAt: offer.expiresAt || null,
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

// ---------------------------------------------------------------------
// Prebook details → seat options
//
// Confirmed against LiteAPI's own Flight Seat Map Implementation Guide
// (docs.liteapi.travel/docs/flight-seat-map-implementation-guide): seat
// services live at servicesAttachable.groups[].services[], each tagged
// category: 'seat' (that array also carries other ancillary categories
// — the filter is what isolates seats). An earlier version of this
// function guessed at five different flat-array paths (available
// Services.seats / services.seats / ancillaries.seats / seatMap /
// seats) — none of which matched this nested shape, so the function
// was ALWAYS falling through to the warning below and returning [] —
// seat selection was silently unavailable in production regardless of
// what LiteAPI actually returned.
//
// Per-field mapping is also corrected against the same doc:
//   seatNumber → metadata.seat.seatNumber, with the documented
//     fallback of parsing it from the `name` field ("Seat 12C") when
//     metadata.seat is absent.
//   available  → metadata.seat.available, defaulting to true when
//     metadata.seat itself is absent (also documented).
//   tier       → now prefers LiteAPI's own metadata.seat.seatType
//     ("standard" / "extra_legroom" / "exit_row") over the old
//     price-only guess, falling back to the price heuristic only when
//     seatType is missing entirely. exit_row now maps to its own
//     "exit-row" tier — SkyrioSeatMap.jsx (verified separately) has
//     been updated to render it with its own color/legend entry
//     rather than falling back to generic "Standard" styling.
//   segmentKey → captured and passed through so SkyrioSeatMap can
//     scope a round trip's seat map to one flight leg at a time and
//     avoid seat-number collisions between outbound and return
//     (verified separately — see SkyrioSeatMap.jsx's
//     scopedSeatServices).
//
// serviceId and the price field were already correct in the earlier
// version (s.serviceId and s.pricing?.display?.amount both match the
// real shape) — unchanged here.
// ---------------------------------------------------------------------
export function parsePrebookSeatOptions(data) {
  if (!data || typeof data !== "object") return [];

  const record = Array.isArray(data.data) ? data.data[0] : data.data || data;

  const groups = record?.servicesAttachable?.groups;
  const candidates = Array.isArray(groups)
    ? groups
        .flatMap((g) => (Array.isArray(g?.services) ? g.services : []))
        .filter((s) => s?.category === "seat")
    : [];

  if (!candidates.length) {
    console.warn(
      "[LiteAPI Flights] parsePrebookSeatOptions: no seat services found under servicesAttachable.groups[].services[]. Top-level keys:",
      Object.keys(record || {})
    );
    return [];
  }

  return candidates
    .map((s) => {
      const meta = s.metadata?.seat;

      // Documented fallback: if metadata.seat is absent, parse
      // row/column from the `name` field (e.g. "Seat 12C").
      let seatNumber = meta?.seatNumber;
      if (!seatNumber && s.name) {
        const m = /\b(\d+)([A-Za-z]+)\b/.exec(s.name);
        if (m) seatNumber = `${m[1]}${m[2]}`;
      }
      if (!seatNumber) return null;

      const serviceId = s.serviceId ?? seatNumber;
      const price = Number(s.pricing?.display?.amount ?? 0) || 0;

      // Documented default when metadata.seat is absent: treat as
      // available. Otherwise trust the explicit flag.
      const available = meta ? meta.available !== false : true;

      // Prefer LiteAPI's own classification over the price guess
      // where it's present. SkyrioSeatMap.jsx now has real support
      // for all three tier values below.
      const tier =
        meta?.seatType === "extra_legroom"
          ? "extra-legroom"
          : meta?.seatType === "exit_row"
          ? "exit-row"
          : meta?.seatType === "standard"
          ? "standard"
          : price >= 50
          ? "premium"
          : price > 0
          ? "extra-legroom"
          : "standard";

      return {
        seatNumber: String(seatNumber),
        serviceId: String(serviceId),
        available: !!available,
        price,
        tier,
        segmentKey: s.segmentKey || null,
      };
    })
    .filter(Boolean);
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
