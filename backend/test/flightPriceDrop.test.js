// "Your flight got cheaper": only real savings, only with a full refund.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LITEAPI_SANDBOX_KEY ||= "test";
const { checkFlightPriceDrop, flightCanBeWatched, fullRefundNow, replaceOldFlight } = await import(
  "../services/flightPriceDrop.js"
);
const { duffelRefundTerms } = await import("../services/duffelOrders.js");
const { journeyKey } = await import("../routes/api/flights/Duffelflights.utils.js");

const NOW = Date.parse("2027-01-01T12:00:00Z");
const slices = (dep = "2027-01-20T08:00:00") => [
  { segments: [{ carrierCode: "UA", flightNumber: "UA123", departureTime: dep }] },
];
const KEY = journeyKey({ slices: slices() });
const flight = (over = {}) => ({
  _id: "f1",
  user: "u1",
  type: "Flight",
  status: "confirmed",
  provider: "liteapi",
  totalAmount: 400,
  totalCurrency: "USD",
  travelers: 1,
  providerBookingIds: ["lite-f1"],
  flight: {
    bookingId: "lite-f1",
    journeyKey: KEY,
    extrasAmount: 0,
    departureAt: "2027-01-20T08:00:00",
    search: { origin: "EWR", destination: "SJU", departureDate: "2027-01-20", adults: 1, cabinClass: "economy" },
    ...(over.flight || {}),
  },
  ...over,
  ...(over.flight ? { flight: { bookingId: "lite-f1", journeyKey: KEY, extrasAmount: 0, departureAt: "2027-01-20T08:00:00", search: {}, ...over.flight } } : {}),
});
const result = (price, over = {}) => ({ totalAmount: price, totalCurrency: "USD", slices: slices(), ...over });
const full = async () => ({ ok: true, via: "void", refund: 400 });

test("same flights, cheaper, full refund → saving shown", async () => {
  const r = await checkFlightPriceDrop(flight(), { now: NOW, search: async () => [result(380), result(330)], refundNow: full });
  assert.equal(r.ok, true);
  assert.equal(r.savings, 70);
  assert.equal(r.now, 330);
});

test("a different flight, a tiny saving, or a different fare brand is never shown", async () => {
  const other = result(200, { slices: slices("2027-01-20T09:30:00") });
  assert.equal((await checkFlightPriceDrop(flight(), { now: NOW, search: async () => [other], refundNow: full })).ok, false);
  assert.equal((await checkFlightPriceDrop(flight(), { now: NOW, search: async () => [result(390)], refundNow: full })).ok, false);
  const branded = flight({ flight: { fareFamily: "Economy" } });
  const basic = result(250, { fareFamily: "Basic Economy" });
  assert.equal((await checkFlightPriceDrop(branded, { now: NOW, search: async () => [basic], refundNow: full })).ok, false);
});

test("no full refund on the old ticket → no saving shown", async () => {
  const r = await checkFlightPriceDrop(flight(), {
    now: NOW,
    search: async () => [result(300)],
    refundNow: async () => ({ ok: false, reason: "partial_refund" }),
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /wouldn't refund/);
});

test("not watched: paid seats or bags, unknown extras, group trips, soon departures, older bookings", () => {
  assert.equal(flightCanBeWatched(flight(), NOW), true);
  assert.equal(flightCanBeWatched(flight({ flight: { extrasAmount: 25 } }), NOW), false);
  assert.equal(flightCanBeWatched(flight({ flight: { extrasAmount: null } }), NOW), false);
  assert.equal(flightCanBeWatched(flight({ syncGroup: "g1" }), NOW), false);
  assert.equal(flightCanBeWatched(flight({ flight: { departureAt: "2027-01-03T08:00:00" } }), NOW), false);
  assert.equal(flightCanBeWatched(flight({ flight: { journeyKey: null } }), NOW), false);
});

test("LiteAPI: only a void or a confirmed full refund to the card counts", async () => {
  const q = (d) => ({ liteQuote: async () => ({ data: { data: d } }) });
  const b = flight();
  assert.equal((await fullRefundNow(b, q({ destination: "original_payment", isVoidable: true }))).ok, true);
  assert.equal((await fullRefundNow(b, q({ destination: "original_payment", confidence: "confirmed", refund: { amount: 400 } }))).ok, true);
  assert.equal((await fullRefundNow(b, q({ destination: "original_payment", confidence: "estimated", refund: 400 }))).ok, false);
  assert.equal((await fullRefundNow(b, q({ destination: "original_payment", confidence: "confirmed", refund: 300 }))).ok, false);
  assert.equal((await fullRefundNow(b, q({ destination: "voucher", isVoidable: true }))).ok, false);
  assert.equal((await fullRefundNow(b, q({ destination: "agency_deposit", isVoidable: true }))).ok, false);
});

test("Duffel: full refund to the original payment → the traveler gets everything back", async () => {
  const t = duffelRefundTerms({ refund_to: "original_form_of_payment", refund_amount: "380.00" }, { paid: 400, net: 380 });
  assert.equal(t.full, true);
  assert.equal(t.customerRefund, 400);
  const part = duffelRefundTerms({ refund_to: "original_form_of_payment", refund_amount: "200.00" }, { paid: 400, net: 380 });
  assert.equal(part.full, false);
  assert.equal(part.customerRefund, 200);
  const credit = duffelRefundTerms({ refund_to: "airline_credits", refund_amount: "380.00" }, { paid: 400, net: 380 });
  assert.equal(credit.refundTo, "airline_credit");
  assert.equal(credit.customerRefund, 0);
  const b = flight({ provider: "duffel", providerBookingIds: ["ord_1"], flight: { bookingId: "ord_1" } });
  const r = await fullRefundNow(b, {
    getOrder: async () => ({ total_amount: "380.00" }),
    duffelQuote: async () => ({ refund_to: "original_form_of_payment", refund_amount: "380.00" }),
  });
  assert.equal(r.ok, true);
});

// ── Replacing the old ticket after the new one is booked ──
const fakeDb = (oldDoc) => ({
  Booking: {
    findById: async (id) => (String(id) === String(oldDoc?._id) ? oldDoc : null),
    updateOne: async () => {},
  },
});

test("same account, same flights, full refund now → old ticket cancelled", async () => {
  let cancelled = 0;
  const r = await replaceOldFlight(
    { newBooking: flight({ _id: "f2" }), oldBookingId: "f1", userId: "u1" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: full,
      cancelBookingCore: async () => { cancelled++; return { status: 200, body: { ok: true, customerRefund: 400 } }; } }
  );
  assert.equal(r.status, "cancelled");
  assert.equal(cancelled, 1);
});

test("airline still confirming → pending, not 'done'", async () => {
  const r = await replaceOldFlight(
    { newBooking: flight({ _id: "f2" }), oldBookingId: "f1", userId: "u1" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: full,
      cancelBookingCore: async () => ({ status: 202, body: { ok: true, pending: true } }) }
  );
  assert.equal(r.status, "pending");
});

test("refund no longer full → old ticket kept; airline down → retry; other people's or other flights → refused", async () => {
  const never = async () => { throw new Error("must not cancel"); };
  const kept = await replaceOldFlight(
    { newBooking: flight({ _id: "f2" }), oldBookingId: "f1", userId: "u1" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: async () => ({ ok: false }), cancelBookingCore: never }
  );
  assert.equal(kept.status, "fee");
  const retry = await replaceOldFlight(
    { newBooking: flight({ _id: "f2" }), oldBookingId: "f1", userId: "u1" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: async () => { throw new Error("timeout"); }, cancelBookingCore: never }
  );
  assert.equal(retry.status, "retry");
  const stranger = await replaceOldFlight(
    { newBooking: flight({ _id: "f2", user: "u2" }), oldBookingId: "f1", userId: "u2" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: full, cancelBookingCore: never }
  );
  assert.equal(stranger.status, "not_allowed");
  const otherFlight = flight({ _id: "f2", flight: { journeyKey: "AA1@2027-01-20T10:00" } });
  const diff = await replaceOldFlight(
    { newBooking: otherFlight, oldBookingId: "f1", userId: "u1" },
    { ...fakeDb(flight()), readManageToken: () => null, refundNow: full, cancelBookingCore: never }
  );
  assert.equal(diff.status, "not_allowed");
});

const { priceWatchStatus } = await import("../services/priceWatchStatus.js");
test("Price Watch line: on says exactly when we'd tell them; off says why", () => {
  assert.equal(priceWatchStatus(flight(), NOW).on, true);
  assert.match(priceWatchStatus(flight({ flight: { extrasAmount: 30 } }), NOW).text, /seats or bags/);
  assert.match(priceWatchStatus(flight({ flight: { journeyKey: null } }), NOW).text, /before Price Watch/);
  assert.match(priceWatchStatus(flight({ flight: { departureAt: "2027-01-03T08:00:00" } }), NOW).text, /3 days/);
  assert.equal(priceWatchStatus(flight({ status: "cancelled" }), NOW), null);
});
