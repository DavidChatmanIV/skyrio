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
  const legs = [{ origin, destination, date: departureDate }];

  if (returnDate) {
    legs.push({ origin: destination, destination: origin, date: returnDate });
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

export function normalizeFlightOffer(journey = {}) {
  const offer = journey.cheapestOffer || journey.offers?.[0] || {};
  const display = offer.pricing?.display || offer.pricing || {};
  const segments = journey.segments || [];

  const outbound = buildSlice(
    segments.filter((s) => s.direction === "OUTBOUND")
  );
  const inbound = buildSlice(segments.filter((s) => s.direction === "INBOUND"));
  const slices = [outbound, inbound].filter(Boolean);

  // If there's no direction field at all (single one-way response),
  // treat every segment as one outbound slice rather than dropping it.
  if (slices.length === 0 && segments.length > 0) {
    slices.push(buildSlice(segments));
  }

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

export function normalizeFlightSearchResponse(data = {}) {
  const journeys = extractJourneys(data);
  return journeys.map(normalizeFlightOffer);
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
