// PRICE CHECK rules Atlas follows before showing a total.
// Run: npm --workspace backend test
import { test } from "node:test";
import assert from "node:assert/strict";
import { tripPriceCheck, checkHotel, checkFlight } from "../services/atlas/priceCheck.js";

const flight = (price, adults = 2, arrive = "2027-01-20T14:05:00", home = "2027-01-26T16:00:00") => ({
  display: { price, outbound: { arriveLocal: arrive }, returnTrip: { departLocal: home }, returnDepart: home },
  search: { adults, children: 0, returnDate: home.slice(0, 10) },
});
const hotel = (total, rooms = 1, checkin = "2027-01-20", checkout = "2027-01-26", adults = 2, starRating) => ({
  display: { totalForAllRooms: total, rooms, starRating },
  search: { checkin, checkout, rooms, adults },
});

test("Flight total + Hotel total = Trip total, then per person", () => {
  const r = tripPriceCheck({ flight: flight(640), hotel: hotel(894) });
  assert.equal(r.ok, true);
  assert.equal(r.tripTotal, 1534);
  assert.equal(r.perPerson, 767);
  assert.equal(r.hotel.nights, 6);
  assert.equal(r.hotel.perRoomPerNight, 149);
  assert.equal(r.flight.perPerson, 320);
  assert.match(r.breakdown, /Flight \$640 .* \+ Hotel \$894 .* = Trip total \$1,534 · \$767 per person/);
});

test("a fare priced for fewer travelers than the trip is a problem", () => {
  const r = tripPriceCheck({ flight: flight(640), hotel: hotel(894, 2, undefined, undefined, 4), travelersAsked: 4 });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /priced for 2 travelers, not 4/);
});

test("hotel nights must run from landing to the flight home", () => {
  const r = tripPriceCheck({ flight: flight(640), hotel: hotel(1043, 1, "2027-01-19") });
  assert.equal(r.ok, false);
  assert.equal(r.datesMismatch.unusedNights, 1);
});

test("landing before 6 AM: the night before counts", () => {
  const r = tripPriceCheck({ flight: flight(640, 2, "2027-01-20T05:10:00"), hotel: hotel(1043, 1, "2027-01-19") });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

test("a hotel searched for fewer adults than the flight is a problem", () => {
  const r = tripPriceCheck({ flight: flight(1280, 4), hotel: hotel(894, 1, undefined, undefined, 1) });
  assert.equal(r.ok, false);
});

test("prices far below normal are flagged; normal ones aren't", () => {
  const r = tripPriceCheck({ flight: flight(60), hotel: hotel(150, 2), hotelOthers: [900, 1000, 1100, 150] });
  assert.ok(r.lowPrice.length >= 2);
  assert.equal(checkHotel(hotel(900), [900, 1000, 1100]).low.length, 0);
  assert.equal(checkFlight(flight(640), [600, 640, 700]).low.length, 0);
});

test("a 4-star at $61 a room a night is flagged (Nov 16 report)", () => {
  const low = checkHotel(hotel(365.62, 2, "2027-01-21", "2027-01-24", 4, 4)).low;
  assert.match(low[0], /far below normal for a 4-star hotel/);
});
