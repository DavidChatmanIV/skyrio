// Flights show the airline that flies the plane, not a ticket seller like Hahn Air.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFlightOffer, toFrontendFlightShape } from "../routes/api/flights/Liteapiflights.utils.js";

const seg = (o, d, t1, t2, carrier) => ({
  originCode: o, destinationCode: d, departureTime: t1, arrivalTime: t2, carrier, flight: { marketingNumber: "X1" },
});
const trip = (carrier) =>
  toFrontendFlightShape(
    normalizeFlightOffer(
      {
        journeyKey: "k",
        cheapestOffer: { offerId: "o", pricing: { display: { total: 500, currency: "USD" } } },
        segments: [
          seg("EWR", "SJU", "2027-01-21T08:00", "2027-01-21T12:00", carrier),
          seg("SJU", "EWR", "2027-01-24T08:00", "2027-01-24T12:00", carrier),
        ],
      },
      { destination: "SJU", returnDate: "2027-01-24" }
    )
  );

test("Hahn Air selling a JetBlue flight shows JetBlue, sold by Hahn Air", () => {
  const f = trip({ marketingName: "Hahn Air", marketingCode: "HR", operatingName: "JetBlue" });
  assert.equal(f.owner, "JetBlue");
  assert.equal(f.soldBy, "Hahn Air");
  assert.equal(f.ownerCode, "HR"); // the ticket is still Hahn Air's
});

test("same airline (JetBlue / JetBlue Airways): no 'sold by'", () => {
  const f = trip({ marketingName: "JetBlue", marketingCode: "B6", operatingName: "JetBlue Airways" });
  assert.equal(f.soldBy, null);
});

test("no operating airline given: the seller's name as before", () => {
  const f = trip({ marketingName: "Delta", marketingCode: "DL" });
  assert.equal(f.owner, "Delta");
  assert.equal(f.soldBy, null);
});
