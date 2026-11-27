import { test } from "node:test";
import assert from "node:assert/strict";
process.env.VIATOR_SANDBOX_KEY ||= "test";
const { rankDestinations } = await import("../routes/api/excursions/excursions.controller.js");

test("'Iceland' finds the country, not a small region", () => {
  const list = [
    { destinationId: 1, name: "South Iceland", type: "REGION" },
    { destinationId: 2, name: "West Iceland", type: "REGION" },
    { destinationId: 3, name: "Iceland", type: "COUNTRY" },
    { destinationId: 4, name: "Reykjavik", type: "CITY" },
  ];
  assert.equal(rankDestinations(list, "Iceland")[0].destinationId, 3);
  assert.equal(rankDestinations(list, "iceland ").length, 3);
});

test("city searches still find the city first", () => {
  const list = [
    { destinationId: 10, name: "Miami Beach", type: "CITY" },
    { destinationId: 11, name: "Miami", type: "CITY" },
    { destinationId: 12, name: "North Miami", type: "CITY" },
  ];
  assert.deepEqual(rankDestinations(list, "Miami").map((d) => d.destinationId), [11, 10, 12]);
});
