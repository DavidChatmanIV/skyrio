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

// ── Replacing the old stay after the new one is booked ──
const { replaceOldStay } = await import("../services/stayPriceDrop.js");
const fakeDb = (oldDoc) => {
  const updates = [];
  return {
    updates,
    Booking: {
      findById: async (id) => (String(id) === String(oldDoc?._id) ? oldDoc : null),
      updateOne: async (q, u) => updates.push([String(q._id), u.$set]),
    },
  };
};
const stay = (id, user, over = {}) => ({
  _id: id, user, type: "Hotel", status: "confirmed", totalAmount: 600, refundAmount: 0,
  hotelStay: { rooms: [{ hotelId: "h1", checkin: "2027-01-21", checkout: "2027-01-24" }], confirmation: [{ bookingId: "lite-1" }] },
  ...over,
});
const freeNow = async () => ({ data: { cancellationPolicies: { refundableTag: "RFN", cancelPolicyInfos: [{ cancelTime: "2099-01-01T00:00:00Z", amount: 600 }] } } });

test("same account, same stay, free to cancel → old one cancelled on the server", async () => {
  const db = fakeDb(stay("old1", "u1"));
  let cancelled = 0;
  const r = await replaceOldStay(
    { newBooking: stay("new1", "u1"), oldBookingId: "old1", userId: "u1" },
    { Booking: db.Booking, readManageToken: () => null, getBooking: freeNow,
      cancelBookingCore: async () => { cancelled++; return { status: 200, body: { ok: true, customerRefund: 600 } }; } }
  );
  assert.equal(r.status, "cancelled");
  assert.equal(r.refund, 600);
  assert.equal(cancelled, 1);
});

test("someone else's booking is never cancelled", async () => {
  const db = fakeDb(stay("old1", "u1"));
  let cancelled = 0;
  const r = await replaceOldStay(
    { newBooking: stay("new1", "u2"), oldBookingId: "old1", userId: "u2" },
    { Booking: db.Booking, readManageToken: () => null, getBooking: freeNow, cancelBookingCore: async () => { cancelled++; } }
  );
  assert.equal(r.status, "not_allowed");
  assert.equal(cancelled, 0);
});

test("a guest's email link lets them replace their own stay; a different stay is refused", async () => {
  const db = fakeDb(stay("old1", null));
  const ok = await replaceOldStay(
    { newBooking: stay("new1", null), oldBookingId: "old1", manageToken: "t" },
    { Booking: db.Booking, readManageToken: () => "old1", getBooking: freeNow,
      cancelBookingCore: async () => ({ status: 200, body: { ok: true, customerRefund: 600 } }) }
  );
  assert.equal(ok.status, "cancelled");
  const other = stay("new2", null, { hotelStay: { rooms: [{ hotelId: "h2", checkin: "2027-01-21", checkout: "2027-01-24" }], confirmation: [] } });
  const db2 = fakeDb(stay("old1", null));
  const no = await replaceOldStay(
    { newBooking: other, oldBookingId: "old1", manageToken: "t" },
    { Booking: db2.Booking, readManageToken: () => "old1", getBooking: freeNow, cancelBookingCore: async () => { throw new Error("must not cancel"); } }
  );
  assert.equal(no.status, "not_allowed");
});

test("a fee now → old booking kept; hotel down → retry later", async () => {
  const feeNow = async () => ({ data: { cancellationPolicies: { refundableTag: "RFN", cancelPolicyInfos: [{ cancelTime: "2000-01-01T00:00:00Z", amount: 600 }] } } });
  const r1 = await replaceOldStay(
    { newBooking: stay("new1", "u1"), oldBookingId: "old1", userId: "u1" },
    { Booking: fakeDb(stay("old1", "u1")).Booking, readManageToken: () => null, getBooking: feeNow, cancelBookingCore: async () => { throw new Error("no"); } }
  );
  assert.equal(r1.status, "fee");
  const r2 = await replaceOldStay(
    { newBooking: stay("new1", "u1"), oldBookingId: "old1", userId: "u1" },
    { Booking: fakeDb(stay("old1", "u1")).Booking, readManageToken: () => null, getBooking: freeNow,
      cancelBookingCore: async () => ({ status: 502, body: { message: "hotel didn't accept" } }) }
  );
  assert.equal(r2.status, "retry");
});

test("the saving is measured against what was actually charged", async () => {
  // Listed $600 at search, but $640 was charged at payment → saving $124, not $84.
  const r = await run(booking({ totalAmount: 640 }), [{ price: 516 }]);
  assert.equal(r.savings, 124);
});
