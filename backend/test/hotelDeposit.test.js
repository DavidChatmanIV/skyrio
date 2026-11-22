import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStayRules, summarizeHotelCharges } from "../routes/api/hotels/hotels.utils.js";
// The email module creates a Resend client on import; tests never send.
process.env.RESEND_API_KEY ||= "re_test";
const { atHotelLines } = await import("../services/bookingEmails.js");

const sunsetInn = [
  "A damage deposit of USD 100.0 is required at checkin.",
  "This will be collected by cash.",
  "You should be reimbursed on checkout via cash, subject to an inspection of the property.",
];

test("cash deposit → short summary that keeps every condition", () => {
  const { deposit, other } = summarizeHotelCharges(sunsetInn);
  assert.equal(deposit.headline, "Bring $100 cash.");
  assert.equal(
    deposit.details,
    "The hotel holds it as a damage deposit at check-in and returns it in cash at check-out if the room passes inspection."
  );
  assert.deepEqual(deposit.original, sunsetInn);
  assert.deepEqual(other, []);
});

test("cash or card deposit says so; no return promise the hotel didn't make", () => {
  const { deposit } = summarizeHotelCharges(["A security deposit of EUR 50 is collected at check-in by cash or credit card."]);
  assert.equal(deposit.headline, "€50 deposit (cash or card) at check-in.");
  assert.equal(deposit.details, "The hotel holds it as a security deposit.");
});

test("general 'charges may be mandatory (e.g., resort fees)' wording stays in the rules", () => {
  const r = cleanStayRules([
    { title: "Fees", text: "These charges may be mandatory (e.g., resort fees) or optional (parking) and are not included in the room rate. A resort fee of USD 25 per night is collected at the property." },
  ]);
  assert.match(r.conditions[0].text, /may be mandatory/);
  assert.equal(r.deposit, null);
  assert.deepEqual(r.otherCharges, ["A resort fee of USD 25 per night is collected at the property."]);
});

test("email uses the same wording as checkout", () => {
  const { deposit } = summarizeHotelCharges(sunsetInn);
  const lines = atHotelLines({ deposit, otherCharges: [] });
  assert.equal(lines[0].bold, "Bring $100 cash.");
  assert.equal(lines[1].bold, "Hotel's wording:");
});
