// No hidden fees: what the hotel collects at check-in is read and shown.
import { test } from "node:test";
import assert from "node:assert/strict";
process.env.LITEAPI_SANDBOX_KEY ||= "test";
process.env.RESEND_API_KEY ||= "re_test";
const { payAtHotelOf, normalizeHotelRate } = await import("../routes/api/hotels/hotels.utils.js");
const { atHotelLines } = await import("../services/bookingEmails.js");
const { normalizeEvent } = await import("../utils/eventsUtils.js");

const roomType = {
  offerId: "o1",
  offerRetailRate: { amount: 420, currency: "USD" },
  rates: [
    {
      name: "King",
      retailRate: {
        total: [{ amount: 420 }],
        taxesAndFees: [
          { included: true, description: "Sales tax", amount: 40, currency: "USD" },
          { included: false, description: "City tax", amount: 12.5, currency: "USD" },
          { included: false, description: "Resort fee", amount: 75, currency: "USD" },
        ],
      },
    },
  ],
};

test("fees the hotel collects at check-in are read from each rate", () => {
  assert.deepEqual(payAtHotelOf(roomType), { amount: 87.5, currency: "USD", names: ["City tax", "Resort fee"] });
  const [room] = normalizeHotelRate({ hotelId: "h1", roomTypes: [roomType] });
  assert.equal(room.payAtHotel.amount, 87.5);
  assert.equal(payAtHotelOf({ rates: [{ retailRate: { taxesAndFees: [{ included: true, amount: 5 }] } }] }), null);
});

test("the confirmation email says what's paid at the hotel", () => {
  const lines = atHotelLines({ payAtHotel: { amount: 87.5, currency: "USD", names: ["City tax", "Resort fee"] } });
  assert.match(lines[0].text, /\$87\.50 \(City tax, Resort fee\) at check-in\. This isn't included/);
});

test("event prices say whether Ticketmaster's fees are in", () => {
  const base = { id: "e1", name: "Show", dates: { start: {} } };
  assert.equal(normalizeEvent({ ...base, priceRanges: [{ type: "standard", min: 45, max: 90 }] }).priceRange.includesFees, false);
  assert.equal(normalizeEvent({ ...base, priceRanges: [{ type: "standard including fees", min: 52, max: 99 }] }).priceRange.includesFees, true);
});
