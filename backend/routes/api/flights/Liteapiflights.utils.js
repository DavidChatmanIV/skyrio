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
  const offer = journey.cheapestOffer || {};
  const display = offer.pricing?.display || {};
  const segments = journey.segments || [];

  const outbound = buildSlice(
    segments.filter((s) => s.direction === "OUTBOUND")
  );
  const inbound = buildSlice(segments.filter((s) => s.direction === "INBOUND"));
  const slices = [outbound, inbound].filter(Boolean);

  return {
    id: journey.journeyKey,
    provider: "liteapi",
    offerId: offer.offerId,
    isCheapest: !!journey.isCheapest,
    price: {
      amount: display.total,
      currency: display.currency,
      base: display.base,
      taxes: display.taxes,
      fees: display.fees,
    },
    fareFamily: offer.fare?.family,
    seatsRemaining: offer.fare?.seatsRemaining,
    totalDurationMinutes: journey.totalDuration?.minutes,
    slices,
    raw: journey, // keep raw journey during integration/debugging
  };
}

export function normalizeFlightSearchResponse(data = {}) {
  // LiteAPI wraps the whole search result in a one-item array under `data`.
  const container = Array.isArray(data.data) ? data.data[0] : data;
  const journeys = container?.journeys || [];
  return journeys.map(normalizeFlightOffer);
}

/**
 * Flattens a normalized LiteAPI offer into the flat shape the frontend
 * (BookingPage.jsx, BookingCheckout) already expects from the earlier
 * Duffel integration: flight.owner, flight.totalAmount, flight.origin,
 * flight.departingAt, flight.stops, flight.id, etc. Keeping this mapping
 * here means the frontend needs zero changes when switching providers.
 */
export function toFrontendFlightShape(offer = {}) {
  const outbound = offer.slices?.[0] || {};
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
    stops: outbound.stops ?? 0,
    fareFamily: offer.fareFamily,
    seatsRemaining: offer.seatsRemaining,
    totalDurationMinutes: offer.totalDurationMinutes,
    slices: offer.slices,
    raw: offer.raw,
  };
}

/**
 * CONFIRMED via live 4xx errors against the real endpoints (not guessed):
 *   1. POST /flights/verify        { offerId }
 *   2. POST /flights/prebooks      { offerId, usePaymentSdk, includeCreditBalance,
 *                                     payment: { descriptorSuffix }, contact: { email },
 *                                     passengers: [...] }
 *      -> returns a prebookId
 *   3. POST /flights/prebooks/{prebookId}/services   { selectedServices, voucherCode? }
 *      (optional — seat selection / extra bags)
 *   4. POST /flights/bookings      { prebookID, ...payment }  -- note capital ID
 *      -> finalizes the booking
 *
 * STILL UNCONFIRMED: exact shape of `passengers[]` (firstName/lastName/dateOfBirth/
 * passport fields, etc.) and what else `/bookings` needs beyond prebookID (payment
 * confirmation details, most likely, since Stripe SDK is involved). Confirm both by
 * running the flow with a REAL, fresh offerId from a search result — the docs-example
 * offerId used during testing was expired, which is why every step returned
 * "offer/prebook not found" rather than a field-validation error.
 */

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

export function buildCompleteBookingPayload({ prebookID, ...rest }) {
  return {
    prebookID,
    ...rest,
  };
}

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
