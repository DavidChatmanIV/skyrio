import { test } from "node:test";
import assert from "node:assert/strict";
process.env.STRIPE_SECRET_KEY ||= "sk_test_x";
const { duffelSeatMapsToSeats, resolveDuffelSeats, duffelSeatTier } = await import(
  "../routes/api/flights/Duffelflights.seats.js"
);

const seat = (designator, services, extra = {}) => ({ type: "seat", designator, available_services: services, ...extra });
const svc = (id, pax, amount) => ({ id, passenger_id: pax, total_amount: String(amount), total_currency: "USD" });
const map = (segment_id, elements) => ({ segment_id, cabins: [{ rows: [{ sections: [{ elements }] }] }] });
const MAPS = [
  map("seg_back", [seat("1A", [svc("ase_b1", "pas_1", 0)])]),
  map("seg_out", [
    seat("10A", [svc("ase_1", "pas_1", 25), svc("ase_2", "pas_2", 25)]),
    seat("10B", []),
    seat("12C", [svc("ase_3", "pas_1", 0)], { name: "Exit row seat" }),
  ]),
];

test("Duffel seat maps read in flight order, same shape as LiteAPI seats", () => {
  const seats = duffelSeatMapsToSeats(MAPS, ["seg_out", "seg_back"]);
  assert.equal(seats[0].segmentKey, "seg_out");
  assert.deepEqual(seats[0], { seatNumber: "10A", serviceId: "seg_out|10A", available: true, price: 25, tier: "paid", segmentKey: "seg_out" });
  assert.equal(seats[1].available, false); // no services = taken
  assert.equal(seats[2].tier, "exit-row"); // only from Duffel's own wording
  assert.equal(seats.at(-1).segmentKey, "seg_back");
  assert.equal(duffelSeatTier({}, 0), "standard");
});

test("each traveler gets their own Duffel seat service, priced from Duffel", () => {
  const r = resolveDuffelSeats(MAPS, ["pas_1", "pas_2"], [
    { passengerIndex: 0, serviceId: "seg_out|10A" },
    { passengerIndex: 1, serviceId: "seg_out|10A" },
  ]);
  assert.deepEqual(r.services.map((s) => s.id), ["ase_1", "ase_2"]);
  assert.equal(r.total, 50);
});

test("a seat that's gone, or not offered to that traveler, is refused", () => {
  assert.match(resolveDuffelSeats(MAPS, ["pas_1", "pas_2"], [{ passengerIndex: 1, serviceId: "seg_out|12C" }]).error, /isn't available for that traveler/);
  assert.match(resolveDuffelSeats(MAPS, ["pas_1"], [{ passengerIndex: 0, serviceId: "seg_out|99Z" }]).error, /isn't on this flight/);
  assert.match(
    resolveDuffelSeats(MAPS, ["pas_1"], [
      { passengerIndex: 0, serviceId: "seg_out|10A" },
      { passengerIndex: 0, serviceId: "seg_out|12C" },
    ]).error,
    /one seat per flight/
  );
});
