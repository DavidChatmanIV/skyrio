// PRICE CHECK: the rules Atlas follows before it shows any total.
//   - Flight total = per-person fare × travelers. The airline's fare is
//     already the total for everyone it was searched for, so the check is
//     that the flight was searched for the same number of travelers.
//   - Hotel total = price per room × rooms × nights. The hotel price
//     already covers every room and night searched; nights = check-out
//     minus check-in, and those dates must match the flights (land → fly
//     home).
//   - Show Flight total + Hotel total = Trip total, then per person.
//   - A total far below normal is checked again before it's shown.
// Pure functions, so they're easy to test.
import { checkStayAgainstFlights } from "./tripTiming.js";

const cents = (n) => Math.round(Number(n) * 100);
const dollars = (c) => c / 100;
const usd = (n) => {
  const v = Number(n);
  const whole = Number.isInteger(v);
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
};

export const nightsBetween = (checkin, checkout) => {
  const a = Date.parse(`${String(checkin || "").slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(checkout || "").slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? Math.round((b - a) / 86400000) : null;
};

// Floors: below these, a price is almost always wrong (one room priced
// instead of two, one traveler instead of four) or a test fare.
export const LOW_HOTEL_PER_ROOM_NIGHT = 40;
export const LOW_FLIGHT_PER_PERSON = { roundTrip: 70, oneWay: 40 };
// Or under half of what the same search's other options cost.
const LOW_VS_OTHERS = 0.5;

const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (s.length < 3) return null; // too few to say what "normal" is
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Travelers a flight was priced for (adults + children), or null. */
export function flightTravelers(search = {}) {
  const a = Number(search.adults);
  if (!Number.isFinite(a) || a < 1) return null;
  return Math.round(a) + Math.max(0, Math.round(Number(search.children) || 0));
}

/**
 * One hotel option → its math and what's wrong with it, if anything.
 *   hotel: { display, search }  (an Atlas option)
 *   others: totals of the other hotels in the same search
 */
export function checkHotel(hotel, others = []) {
  const d = hotel?.display || {};
  const s = hotel?.search || {};
  const total = Number(d.totalForAllRooms ?? d.total);
  const rooms = Math.max(1, Math.round(Number(d.rooms ?? s.rooms)) || 1);
  const nights = nightsBetween(s.checkin, s.checkout) ?? (Number(d.nights) || null);
  const problems = [];
  if (!Number.isFinite(total) || total <= 0) problems.push("The hotel has no price. Search again.");
  if (!nights) problems.push("The hotel dates are missing or check-out isn't after check-in.");
  const perRoomPerNight = Number.isFinite(total) && nights ? dollars(cents(total / rooms / nights)) : null;
  const low = [];
  if (perRoomPerNight != null && perRoomPerNight < LOW_HOTEL_PER_ROOM_NIGHT)
    low.push(`${usd(perRoomPerNight)} per room per night is far below normal`);
  const mid = median(others);
  if (mid && Number.isFinite(total) && total < mid * LOW_VS_OTHERS)
    low.push(`${usd(total)} is under half of what the other hotels in this search cost (about ${usd(Math.round(mid))})`);
  return {
    total: Number.isFinite(total) ? dollars(cents(total)) : null,
    rooms,
    nights,
    perRoomPerNight,
    checkin: s.checkin || null,
    checkout: s.checkout || null,
    adults: Number(s.adults) || null,
    math: perRoomPerNight != null ? `${usd(perRoomPerNight)} per room per night × ${rooms} room${rooms === 1 ? "" : "s"} × ${nights} night${nights === 1 ? "" : "s"}` : null,
    problems,
    low,
  };
}

/** One flight option → its math and what's wrong with it, if anything. */
export function checkFlight(flight, others = []) {
  const d = flight?.display || {};
  const s = flight?.search || {};
  const total = Number(d.price ?? d.total);
  const pricedFor = flightTravelers(s);
  const problems = [];
  if (!Number.isFinite(total) || total <= 0) problems.push("The flight has no price. Search again.");
  const perPerson = Number.isFinite(total) && pricedFor ? dollars(cents(total / pricedFor)) : null;
  const roundTrip = Boolean(s.returnDate || d.returnDepart || d.returnTrip);
  const floor = roundTrip ? LOW_FLIGHT_PER_PERSON.roundTrip : LOW_FLIGHT_PER_PERSON.oneWay;
  const low = [];
  if (perPerson != null && perPerson < floor)
    low.push(`${usd(perPerson)} per person ${roundTrip ? "round trip" : "one way"} is far below normal`);
  const mid = median(others);
  if (mid && Number.isFinite(total) && total < mid * LOW_VS_OTHERS)
    low.push(`${usd(total)} is under half of what the other flights in this search cost (about ${usd(Math.round(mid))})`);
  return {
    total: Number.isFinite(total) ? dollars(cents(total)) : null,
    pricedFor,
    perPerson,
    roundTrip,
    math: perPerson != null ? `${usd(perPerson)} per person × ${pricedFor} traveler${pricedFor === 1 ? "" : "s"}` : null,
    problems,
    low,
  };
}

/**
 * The full PRICE CHECK for one flight + one hotel (either may be missing).
 * travelersAsked: what Atlas passed (who shares the cost), if anything.
 * Returns { ok, travelers, flight, hotel, breakdown, problems, lowPrice }.
 * ok=false → Atlas must not show the total yet (fix first).
 */
export function tripPriceCheck({ flight, hotel, travelersAsked, flightOthers = [], hotelOthers = [] } = {}) {
  const f = flight ? checkFlight(flight, flightOthers) : null;
  const h = hotel ? checkHotel(hotel, hotelOthers) : null;
  const problems = [...(f?.problems || []), ...(h?.problems || [])];

  // Who's on the trip: the flight's own count wins (that's what the fare
  // covers), then what Atlas said, then the hotel's adults.
  const asked = Math.round(Number(travelersAsked)) || null;
  const travelers = f?.pricedFor || asked || h?.adults || 1;
  if (f?.pricedFor && asked && asked !== f.pricedFor)
    problems.push(
      `The flight was priced for ${f.pricedFor} traveler${f.pricedFor === 1 ? "" : "s"}, not ${asked}. Search flights again for ${asked} so the fare covers everyone.`
    );
  if (f?.pricedFor && h?.adults && h.adults < f.pricedFor - Math.max(0, Number(flight?.search?.children) || 0))
    problems.push(
      `The hotel was searched for ${h.adults} adult${h.adults === 1 ? "" : "s"} but the flight has ${f.pricedFor} travelers. Search the hotel again with everyone.`
    );

  // Hotel nights = landing → flying home.
  let dates = null;
  if (f && h && h.checkin && h.checkout && flight?.display?.outbound) {
    const check = checkStayAgainstFlights(
      { checkin: h.checkin, checkout: h.checkout },
      [{ optionId: "f", outbound: flight.display.outbound, returnTrip: flight.display.returnTrip }]
    );
    const row = check?.flights?.[0];
    if (row && !row.matches) {
      dates = row;
      const bits = [];
      if (row.unusedNights) bits.push(`${row.unusedNights} night(s) before they land`);
      if (row.nightsBeforeCheckinWithNoRoom) bits.push(`no room for ${row.nightsBeforeCheckinWithNoRoom} night(s) after they land`);
      if (row.nightsWithoutHotel) bits.push(`no room for ${row.nightsWithoutHotel} night(s) before the flight home`);
      if (row.unusedNightsAtEnd) bits.push(`${row.unusedNightsAtEnd} night(s) after they fly home`);
      problems.push(
        `Hotel nights don't match the flights (${bits.join(", ")}). Hotel nights run from the day they land to the day they fly home: search the hotel again for those dates.`
      );
    }
  }

  const flightC = f?.total != null ? cents(f.total) : 0;
  const hotelC = h?.total != null ? cents(h.total) : 0;
  const tripC = flightC + hotelC;
  const perPersonC = Math.round(tripC / travelers);
  const parts = [];
  if (f?.total != null) parts.push(`Flight ${usd(f.total)}${f.math ? ` (${f.math})` : ""}`);
  if (h?.total != null) parts.push(`Hotel ${usd(h.total)}${h.math ? ` (${h.math})` : ""}`);
  const breakdown = parts.length
    ? `${parts.join(" + ")} = Trip total ${usd(dollars(tripC))} · ${usd(dollars(perPersonC))} per person (${travelers} traveler${travelers === 1 ? "" : "s"})`
    : null;

  const low = [...(f?.low || []).map((w) => `Flight: ${w}`), ...(h?.low || []).map((w) => `Hotel: ${w}`)];
  return {
    ok: problems.length === 0,
    travelers,
    flight: f && { total: f.total, perPerson: f.perPerson, pricedFor: f.pricedFor, math: f.math },
    hotel: h && { total: h.total, rooms: h.rooms, nights: h.nights, perRoomPerNight: h.perRoomPerNight, math: h.math },
    flightTotal: dollars(flightC),
    hotelTotal: dollars(hotelC),
    tripTotal: dollars(tripC),
    perPerson: dollars(perPersonC),
    breakdown,
    problems,
    ...(dates ? { datesMismatch: dates } : {}),
    lowPrice: low.length ? low : undefined,
  };
}
