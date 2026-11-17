// Atlas search results come back from MongoDB after a restart: a fresh
// copy of the tools module (empty memory) still prices "option 2".
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.LITEAPI_SANDBOX_KEY ||= "test";
process.env.RESEND_API_KEY ||= "re_test";

const { default: AtlasOption } = await import("../models/AtlasOption.js");

// A pretend database: what an earlier server saved.
const rows = new Map();
AtlasOption.updateOne = async (q, u) => rows.set(q.key, { key: q.key, ...u.$set });
AtlasOption.deleteOne = async (q) => rows.delete(q.key);
AtlasOption.find = (q) => {
  const keys = q.key.$in;
  const out = keys.map((k) => rows.get(k)).filter((r) => r && (!q.expiresAt || r.expiresAt > q.expiresAt.$gt));
  return { select: () => ({ lean: async () => out }) };
};
// Fresh copies of the module = servers that just restarted (empty memory).
const restarted = await import(`../services/atlas/atlasBookingTools.js?restart=1`);
const restarted2 = await import(`../services/atlas/atlasBookingTools.js?restart=2`);
// "Connected" from here on (after the models are set up).
Object.defineProperty(mongoose.connection, "readyState", { get: () => 1, configurable: true });

test("price_trip finds options saved before a restart", async () => {
  const later = new Date(Date.now() + 10 * 60 * 1000);
  const owner = "g:abc";
  rows.set("f_AAAAAAAA", {
    key: "f_AAAAAAAA",
    owner,
    expiresAt: later,
    data: JSON.stringify({
      owner, kind: "flight", raw: {}, expiresAt: later.getTime(),
      display: { airline: "JetBlue", price: 640, outbound: { arriveLocal: "2027-01-21T14:00:00" }, returnTrip: { departLocal: "2027-01-24T16:00:00" } },
      search: { adults: 2, children: 0, returnDate: "2027-01-24" },
    }),
  });
  rows.set("h_BBBBBBBB", {
    key: "h_BBBBBBBB",
    owner,
    expiresAt: later,
    data: JSON.stringify({
      owner, kind: "hotel", raw: {}, expiresAt: later.getTime(),
      display: { hotel: "Condado Inn", totalForAllRooms: 900, rooms: 1, starRating: 4 },
      search: { checkin: "2027-01-21", checkout: "2027-01-24", rooms: 1, adults: 2 },
    }),
  });

  const { result } = await restarted.runBookingTool(
    "price_trip",
    { optionIds: ["f_AAAAAAAA", "h_BBBBBBBB"] },
    { guestKey: "abc" }
  );
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.tripTotal, 1540);
  assert.equal(result.perPerson, 770);
});

test("someone else's option isn't loaded for you", async () => {
  const { result } = await restarted2.runBookingTool("price_trip", { optionIds: ["f_AAAAAAAA"] }, { guestKey: "zzz" });
  assert.match(String(result.error), /expired|weren't found/);
});
