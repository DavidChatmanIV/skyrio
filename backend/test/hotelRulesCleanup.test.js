import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStayRules, deadlineLabel } from "../routes/api/hotels/hotels.utils.js";

const supplier = [
  { title: "Guarantee Policy", text: "Guarantee Policy: If you don't check-in on the first day, no refund." },
  { title: "Hotel Occupancy Policy", text: "Special requests cannot be guaranteed by Priceline." },
  { title: "Room Charge Disclosure", text: "Your credit card is charged the total cost at time of purchase. Prices and room availability are not guaranteed until full payment is received." },
  { title: "Important information", text: "Guests are required to show a photo ID. Payment before arrival by bank transfer is required. Managed by a private host A damage deposit of USD 100.0 is required at checkin. This will be collected by cash." },
];

test("repeated titles are removed", () => {
  const g = cleanStayRules(supplier).conditions.find((c) => c.title === "Guarantee Policy");
  assert.equal(g.text, "If you don't check-in on the first day, no refund.");
});

test("payment Skyrio already took is hidden and flagged", () => {
  const r = cleanStayRules(supplier);
  assert.equal(r.hidPaymentText, true);
  assert.ok(!JSON.stringify(r.conditions).match(/bank transfer|charged the total cost/i));
  assert.ok(!r.conditions.some((c) => c.title === "Room Charge Disclosure"));
});

test("deposits and cash move to hotelCharges", () => {
  const r = cleanStayRules(supplier);
  assert.deepEqual(r.hotelCharges, [
    "A damage deposit of USD 100.0 is required at checkin.",
    "This will be collected by cash.",
  ]);
  assert.ok(!JSON.stringify(r.conditions).match(/deposit|cash/i));
});

test("other booking sites aren't named; important info comes first", () => {
  const r = cleanStayRules(supplier);
  assert.equal(r.conditions[0].title, "Important information");
  assert.ok(!JSON.stringify(r.conditions).includes("Priceline"));
  assert.match(JSON.stringify(r.conditions), /guaranteed by the booking partner/);
});

test("midnight deadlines show as 11:59 PM the day before", () => {
  assert.equal(deadlineLabel("2026-12-29 00:00:00"), "Dec 28, 11:59 PM");
  assert.equal(deadlineLabel("2026-12-29 18:30:00"), "Dec 29, 6:30 PM");
  assert.equal(deadlineLabel("2026-12-29T00:00:00Z"), "Dec 28, 11:59 PM UTC");
  assert.equal(deadlineLabel("soon"), null);
});
