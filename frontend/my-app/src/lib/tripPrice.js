// PRICE CHECK for the Book page's Flight + Stay trip (same rules as Atlas,
// backend/services/atlas/priceCheck.js):
//   - Flight total = per-person fare × travelers (the airline's fare is
//     already the total for everyone it was searched for).
//   - Hotel total = price per room × rooms × nights; nights run from the
//     day they land to the day they fly home.
//   - Flight total + Hotel total = Trip total, then per person.
//   - A price far below normal is flagged (and it's rechecked at checkout).

export const LOW_HOTEL_PER_ROOM_NIGHT = 40;
export const LOW_FLIGHT_PER_PERSON = { roundTrip: 70, oneWay: 40 };

const dayOf = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : null);
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const nightsBetween = (a, b) => {
  const x = Date.parse(`${dayOf(a)}T00:00:00Z`);
  const y = Date.parse(`${dayOf(b)}T00:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) && y > x ? Math.round((y - x) / 86400000) : null;
};

/** Travelers the fare covers (adults + children), else the fallback. */
export function fareTravelers(rawFlight, fallback = 1) {
  const p = rawFlight?.pricedFor || rawFlight?.raw?.pricedFor;
  const n = Number(p?.adults || 0) + Number(p?.children || 0);
  return n > 0 ? n : Math.max(1, Number(fallback) || 1);
}

/** The hotel night they arrive for: landing before 6 AM counts as the night before. */
export function arrivalNight(arrivingAt) {
  const d = dayOf(arrivingAt);
  if (!d) return null;
  const h = Number(String(arrivingAt).slice(11, 13));
  return Number.isFinite(h) && h < 6 ? addDays(d, -1) : d;
}

/**
 * flight: { price, raw } (the trip's flight) · stay: { total, rooms, checkin, checkout }
 * travelers: how many on the trip.
 * → { flightTotal, stayTotal, tripTotal, perPerson, travelers, flightLine,
 *     stayLine, nights, problems: [..], low: bool }
 */
export function tripPrice({ flight, stay, travelers: plannedTravelers = 1 }) {
  const travelers = flight ? fareTravelers(flight.raw, plannedTravelers) : Math.max(1, Number(plannedTravelers) || 1);
  const flightTotal = flight ? Number(flight.price) || 0 : 0;
  const stayTotal = stay ? Number(stay.total) || 0 : 0;
  const rooms = Math.max(1, Number(stay?.rooms) || 1);
  const nights = stay ? nightsBetween(stay.checkin, stay.checkout) : null;
  const problems = [];

  const flightPP = flight && travelers ? flightTotal / travelers : null;
  const perRoomNight = stay && nights ? stayTotal / rooms / nights : null;

  if (flight && Number(plannedTravelers) > 0 && travelers !== Number(plannedTravelers))
    problems.push(
      `This fare is for ${travelers} traveler${travelers === 1 ? "" : "s"}, not ${plannedTravelers}. Search flights again for ${plannedTravelers}.`
    );

  // Hotel nights vs the flights.
  if (flight?.raw && stay?.checkin && stay?.checkout) {
    const night = arrivalNight(flight.raw.arrivingAt);
    const home = dayOf(flight.raw.returningAt);
    if (night && dayOf(stay.checkin) !== night)
      problems.push(
        dayOf(stay.checkin) < night
          ? "Your stay starts before your flight lands. You'd pay for a night you're not there."
          : "Your stay starts after you land. You'd have no room the first night."
      );
    if (home && dayOf(stay.checkout) !== home)
      problems.push(
        dayOf(stay.checkout) > home
          ? "Your stay ends after your flight home. You'd pay for a night you're not there."
          : "Your stay ends before your flight home. You'd have no room the last night."
      );
  }

  const roundTrip = Boolean(flight?.raw?.returningAt);
  const low =
    (perRoomNight != null && perRoomNight > 0 && perRoomNight < LOW_HOTEL_PER_ROOM_NIGHT) ||
    (flightPP != null &&
      flightPP > 0 &&
      flightPP < (roundTrip ? LOW_FLIGHT_PER_PERSON.roundTrip : LOW_FLIGHT_PER_PERSON.oneWay));

  const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
  const tripTotal = flightTotal + stayTotal;
  return {
    travelers,
    flightTotal,
    stayTotal,
    tripTotal,
    perPerson: tripTotal / travelers,
    nights,
    rooms,
    flightLine:
      flight && flightPP != null
        ? `${usd(flightPP)} per person × ${travelers} traveler${travelers === 1 ? "" : "s"}`
        : null,
    stayLine:
      stay && perRoomNight != null
        ? `${usd(perRoomNight)} per room per night × ${rooms} room${rooms === 1 ? "" : "s"} × ${nights} night${nights === 1 ? "" : "s"}`
        : null,
    problems,
    low,
  };
}
