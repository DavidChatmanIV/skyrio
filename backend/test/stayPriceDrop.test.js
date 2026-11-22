// "Your stay got cheaper": only real, usable savings.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LITEAPI_SANDBOX_KEY ||= "test";
const { checkStayPriceDrop, freeCancelUntil, stayCanBeWatched, minSavingFor } = await import(
  "../services/stayPriceDrop.js"
);

const NOW = Date.parse("2027-01-01T12:00:00Z");
const booking = (over = {}) => ({
  _id: "b1",
  type: "Hotel",
  status: "confirmed",
  provider: "liteapi",
  hotelStay: {
    rooms: [
      { hotelId: "h1", name: "Condado Inn", roomName: "Deluxe King", boardName: "Room Only",
        checkin: "2027-01-21", checkout: "2027-01-24", adults: 2, totalAmount: 600, totalCurrency: "USD" },
    ],
    confirmation: [{ bookingId: "lite-1" }],
  },
  ...over,
});
const freePolicy = { cancellationPolicies: { refundableTag: "RFN", cancelPolicyInfos: [{ cancelTime: "2027-01-19T12:00:00Z", amount: 600 }] } };
const rates = (offers) => async () => ({
  data: [{ hotelId: "h1", roomTypes: offers.map((o, i) => ({
    offerId: `o${i}`, offerRetailRate: { amount: o.price, currency: "USD" },
    rates: [{ name: o.name ?? "Deluxe King", boardName: o.board ?? "Room Only", occupancyNumber: 1,
      retailRate: { total: [{ amount: o.price }] }, cancellationPolicies: { refundableTag: o.tag ?? "RFN" } }],
  })) }],
});
const run = (b, offers, policy = freePolicy) =>
  checkStayPriceDrop(b, { now: NOW, getBooking: async () => ({ data: policy }), searchRates: rates(offers) });

test("same refundable room $84 cheaper, free to cancel → found", async () => {
  const r = await run(booking(), [{ price: 516 }, { price: 700 }]);
  assert.equal(r.ok, true);
  assert.equal(r.savings, 84);
  assert.equal(r.rooms[0].offer.totalAmount, 516);
  assert.equal(r.rooms[0].offer.adults, 2);
  assert.equal(r.freeCancelUntil, "2027-01-19T12:00:00.000Z");
});

test("a cheaper room of another type or board doesn't count", async () => {
  const r = await run(booking(), [{ price: 300, name: "Standard Queen" }, { price: 310, board: "Breakfast" }]);
  assert.equal(r.ok, false);
});

test("a cheaper non-refundable rate doesn't count", async () => {
  assert.equal((await run(booking(), [{ price: 400, tag: "NRFN" }])).ok, false);
});

test("a tiny saving isn't announced", async () => {
  const r = await run(booking(), [{ price: 590 }]);
  assert.equal(r.ok, false);
  assert.equal(minSavingFor(600), 30);
});

test("can't cancel for free anymore → nothing", async () => {
  const late = { cancellationPolicies: { refundableTag: "RFN", cancelPolicyInfos: [{ cancelTime: "2026-12-31T12:00:00Z", amount: 600 }] } };
  assert.equal((await run(booking(), [{ price: 400 }], late)).reason, "not_free_to_cancel");
  assert.equal(freeCancelUntil({ cancellationPolicies: { refundableTag: "NRFN" } }, NOW), null);
});

test("shared rooms, Duffel stays and stays without guest counts are skipped", () => {
  assert.equal(stayCanBeWatched(booking({ sharedRoom: { people: 2 } }), NOW), false);
  assert.equal(stayCanBeWatched(booking({ provider: "duffel" }), NOW), false);
  const noAdults = booking();
  delete noAdults.hotelStay.rooms[0].adults;
  assert.equal(stayCanBeWatched(noAdults, NOW), false);
  assert.equal(stayCanBeWatched(booking(), NOW), true);
});
