// Atlas's Out/Back lines and hotel room coverage.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LITEAPI_SANDBOX_KEY ||= "test";
process.env.RESEND_API_KEY ||= "re_test";
const { legLine, legSummary } = await import("../services/atlas/atlasBookingTools.js");
const { roomsCoveredBy } = await import("../routes/api/hotels/hotels.utils.js");

const back = {
  origin: "SJU", destination: "EWR", departureTime: "2027-01-24T07:15:00", arrivalTime: "2027-01-24T21:29:00",
  segments: [
    { origin: "SJU", destination: "MCO", departureTime: "2027-01-24T07:15:00", arrivalTime: "2027-01-24T10:05:00", flightNumber: "B6 1" },
    { origin: "MCO", destination: "EWR", departureTime: "2027-01-24T18:40:00", arrivalTime: "2027-01-24T21:29:00", flightNumber: "B6 2" },
  ],
};
const redeye = {
  origin: "EWR", destination: "SJU", departureTime: "2027-01-21T22:10:00", arrivalTime: "2027-01-22T02:55:00",
  segments: [{ origin: "EWR", destination: "SJU", departureTime: "2027-01-21T22:10:00", arrivalTime: "2027-01-22T02:55:00", flightNumber: "B6 3" }],
};

test("each direction is one line with its own times and stops", () => {
  assert.equal(legLine(legSummary(back)), "Sun, Jan 24 · SJU 7:15 AM → EWR 9:29 PM · 1 stop · 8h 35m in MCO");
  assert.equal(legLine(legSummary(redeye)), "Thu, Jan 21 · EWR 10:10 PM → SJU 2:55 AM (Fri, Jan 22) · Nonstop");
});

test("rooms a hotel price covers", () => {
  assert.equal(roomsCoveredBy([{ occupancyNumber: 1 }, { occupancyNumber: 1 }]), 1);
  assert.equal(roomsCoveredBy([{ occupancyNumber: 1 }, { occupancyNumber: 2 }]), 2);
  assert.equal(roomsCoveredBy([{}, {}]), 2);
  assert.equal(roomsCoveredBy([]), 1);
});
