// What a flight booking saves so "Your flight got cheaper" can find the
// exact same flights later: every leg (carrier, number, departure), the
// search that found them, the fare brand, and what was paid on top of the
// fare (seats/bags). Bookings with extras aren't watched.
const day = (v) => (v ? String(v).slice(0, 10) : null);
const iata = (v) => (/^[A-Z]{3}$/.test(String(v || "").toUpperCase()) ? String(v).toUpperCase() : null);

export function flightMatchInfo(flight, passengers = [], extrasAmount = 0) {
  const raw = flight?.raw || {};
  const slices = Array.isArray(raw.slices) ? raw.slices : [];
  const journey = slices
    .map((s) => ({
      segments: (s?.segments || []).map((g) => ({
        carrierCode: g?.carrierCode || null,
        flightNumber: g?.flightNumber || null,
        departureTime: g?.departureTime || null,
      })),
    }))
    .filter((s) => s.segments.length);
  const adults = passengers.filter((p) => !p?.type || p.type === "ADT").length || 1;
  const children = Math.max(0, passengers.length - adults);
  const origin = iata(raw.origin || slices[0]?.origin);
  // The cabin the fare was searched in (set by the server on every result).
  // Unknown → not saved, so the booking isn't watched.
  const cabinClass = raw.searchedCabin || flight?.searchedCabin || null;
  const destination = iata(raw.destination || slices[0]?.destination);
  return {
    journey: journey.length ? journey : null,
    search:
      origin && destination && cabinClass && day(raw.departingAt)
        ? {
            origin,
            destination,
            departureDate: day(raw.departingAt),
            returnDate: day(raw.returningAt),
            adults,
            children,
            cabinClass,
          }
        : null,
    fareFamily: raw.fareFamily || null,
    extrasAmount: Math.max(0, Math.round((Number(extrasAmount) || 0) * 100) / 100),
  };
}
