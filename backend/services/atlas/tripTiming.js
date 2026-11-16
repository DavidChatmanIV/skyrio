// Timing checks before Atlas shows a plan:
//   - Events: travelers must land at least 3 hours before an event starts,
//     and their return flight must leave after it ends (shows are assumed
//     to run about 3 hours; Ticketmaster doesn't give an end time).
//   - Hotel nights must match when they're actually there: check in on the
//     day they land, check out on the day they fly home.
//
// Landing times, event times and the return departure are all LOCAL times
// at the destination, so they compare directly with no time zones.

const HOUR = 3600 * 1000;
const LAND_BEFORE_H = 3;
const SHOW_LENGTH_H = 3;
const EARLY_MORNING_H = 6; // landing before 6 AM still uses the night before

/** "2027-01-21T20:00:00" (local) → ms on a fake UTC clock; null if bad. */
export function localMs(s) {
  const m = String(s || "").match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2] || "00"}:${m[3] || "00"}:00Z`);
  return Number.isFinite(t) ? t : null;
}
const iso = (ms) => new Date(ms).toISOString().slice(0, 16); // "2027-01-21T17:00"
const day = (s) => String(s || "").slice(0, 10);
const daysBetween = (a, b) => Math.round((localMs(b) - localMs(a)) / (24 * HOUR));

/** When an event starts (local). Unknown time → noon, so the check is on the safe side. */
function eventStart(e) {
  if (!e?.date) return null;
  return localMs(`${e.date}T${(e.time || "12:00").slice(0, 5)}`);
}

/**
 * One event vs one flight option → null if it fits, else why not:
 * "lands_too_late" or "leaves_too_early".
 */
export function eventMiss(e, flight) {
  const start = eventStart(e);
  if (start == null) return null;
  const land = localMs(flight?.outbound?.arriveLocal);
  if (land != null && land > start - LAND_BEFORE_H * HOUR) return "lands_too_late";
  const leave = localMs(flight?.returnTrip?.departLocal);
  if (leave != null && leave < start + SHOW_LENGTH_H * HOUR) return "leaves_too_early";
  return null;
}

/**
 * Events + this turn's flight options → each event gets:
 *   landBy: latest landing time to make it (local, "YYYY-MM-DDTHH:mm")
 *   fitsFlightOptionIds / missesFlightOptionIds (with why)
 *   fitsAnyFlight: false when none of the flights shown get them there
 * No flights → events come back unchanged.
 */
function checkOne(e, opts) {
  const start = eventStart(e);
  if (start == null) return e;
  const fits = [];
  const misses = [];
  for (const f of opts) {
    const why = eventMiss(e, f);
    if (why) misses.push({ optionId: f.optionId, why });
    else fits.push(f.optionId);
  }
  return {
    ...e,
    landBy: iso(start - LAND_BEFORE_H * HOUR),
    timeUnknown: !e.time || undefined,
    fitsAnyFlight: fits.length > 0,
    fitsFlightOptionIds: fits,
    missesFlightOptionIds: misses,
  };
}

/**
 * Same as above for each show and its other nights (otherShows). If the
 * first night doesn't fit any flight but another night does, that night
 * becomes the main one (switchedFrom says which night it replaced), so the
 * traveler sees a showtime they can actually make.
 */
export function checkEventsAgainstFlightsAll(events = [], flights = []) {
  const opts = (flights || []).filter((f) => f?.optionId && f.outbound);
  if (!opts.length) return events;
  return events.map((e) => {
    const shared = { ...e };
    delete shared.otherShows;
    const nights = [shared, ...(e.otherShows || []).map((o) => ({ ...shared, ...o }))].map((n) => checkOne(n, opts));
    const mainIdx = nights[0].fitsAnyFlight === false ? nights.findIndex((n) => n.fitsAnyFlight) : 0;
    const pick = mainIdx > 0 ? mainIdx : 0;
    const main = nights[pick];
    const others = nights
      .filter((_, i) => i !== pick)
      .map(({ date, time, url, status, landBy, fitsAnyFlight, fitsFlightOptionIds, timeUnknown }) => ({
        date, time, url, status, landBy, fitsAnyFlight, fitsFlightOptionIds, ...(timeUnknown ? { timeUnknown } : {}),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
    return {
      ...main,
      otherShows: others,
      ...(pick > 0 ? { switchedFrom: { date: nights[0].date, time: nights[0].time, why: "no flight shown lands in time" } } : {}),
    };
  });
}

export function checkEventsAgainstFlights(events = [], flights = []) {
  return checkEventsAgainstFlightsAll(events, flights);
}

/** The date they really arrive for hotel purposes (before 6 AM → the night before). */
function arrivalNightDate(arriveLocal) {
  const ms = localMs(arriveLocal);
  if (ms == null) return null;
  const hour = new Date(ms).getUTCHours();
  return day(iso(hour < EARLY_MORNING_H ? ms - 24 * HOUR : ms));
}

/**
 * Hotel dates vs each flight option:
 *   unusedNights: nights paid for before they land
 *   nightsWithoutHotel: nights after check-out before the flight home
 *   alsoNightsBeforeCheckin: they land before check-in day (no room that night)
 */
export function checkStayAgainstFlights({ checkin, checkout } = {}, flights = []) {
  if (!checkin || !checkout) return null;
  const rows = [];
  for (const f of flights || []) {
    if (!f?.optionId || !f.outbound) continue;
    const landsOn = day(f.outbound.arriveLocal);
    const nightOf = arrivalNightDate(f.outbound.arriveLocal);
    const leavesOn = day(f.returnTrip?.departLocal) || null;
    if (!nightOf) continue;
    const unusedNights = Math.max(0, daysBetween(checkin, nightOf));
    const noRoomBefore = Math.max(0, daysBetween(nightOf, checkin));
    const nightsWithoutHotel = leavesOn ? Math.max(0, daysBetween(checkout, leavesOn)) : 0;
    const extraAfter = leavesOn ? Math.max(0, daysBetween(leavesOn, checkout)) : 0;
    rows.push({
      optionId: f.optionId,
      landsOn,
      leavesOn,
      matches: !unusedNights && !noRoomBefore && !nightsWithoutHotel && !extraAfter,
      ...(unusedNights ? { unusedNights } : {}),
      ...(noRoomBefore ? { nightsBeforeCheckinWithNoRoom: noRoomBefore } : {}),
      ...(nightsWithoutHotel ? { nightsWithoutHotel } : {}),
      ...(extraAfter ? { unusedNightsAtEnd: extraAfter } : {}),
    });
  }
  if (!rows.length) return null;
  const matching = rows.filter((r) => r.matches).map((r) => r.optionId);
  return {
    hotelCheckin: checkin,
    hotelCheckout: checkout,
    flights: rows,
    anyFlightMatches: matching.length > 0,
    matchingFlightOptionIds: matching,
  };
}
