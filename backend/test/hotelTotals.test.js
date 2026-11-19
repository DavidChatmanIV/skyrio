// An offer's price is never less than its rooms' own prices added up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { offerTotal, roomsCoveredBy } from "../routes/api/hotels/hotels.utils.js";

const room = (n, amt) => ({ occupancyNumber: n, retailRate: { total: [{ amount: amt }] } });

test("3 rooms each $424.92 but the offer says $424.92 -> $1,274.76", () => {
  const rt = { offerRetailRate: { amount: 424.92 }, rates: [room(1, 424.92), room(2, 424.92), room(3, 424.92)] };
  assert.equal(offerTotal(rt), 1274.76);
  assert.equal(roomsCoveredBy(rt.rates), 3);
});

test("a correct offer total is kept", () => {
  assert.equal(offerTotal({ offerRetailRate: { amount: 1274.76 }, rates: [room(1, 424.92), room(2, 424.92), room(3, 424.92)] }), 1274.76);
});

test("two choices for the same room aren't added together", () => {
  assert.equal(offerTotal({ offerRetailRate: { amount: 300 }, rates: [room(1, 300), room(1, 350)] }), 300);
});
