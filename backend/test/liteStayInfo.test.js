import { test } from "node:test";
import assert from "node:assert/strict";
import { to12h, liteBreakdown, liteStayInfoFromDetails } from "../routes/api/hotels/hotels.utils.js";

test("to12h reads both 24h and AM/PM times", () => {
  assert.equal(to12h("16:00"), "4:00 PM");
  assert.equal(to12h("04:00 PM"), "4:00 PM");
  assert.equal(to12h("11:00 AM"), "11:00 AM");
  assert.equal(to12h("nope"), null);
});

test("liteStayInfoFromDetails matches the Duffel stayInfo shape", () => {
  const st = liteStayInfoFromDetails({
    phone: "+1 212 555 0100",
    email: "",
    hotelImportantInformation: "Photo ID and card required at check-in.",
    checkinCheckoutTimes: {
      checkin_start: "04:00 PM",
      checkin_end: "12:00 AM",
      checkout: "11:00 AM",
      instructions: [{ id: 1, instruction: "Front desk staff will greet guests." }],
      special_instructions: "Front desk closes at 10 PM; keys in lockbox after.",
    },
    policies: [{ name: "Pets", description: "Pets not allowed." }],
  });
  assert.equal(st.checkInAfter, "4:00 PM");
  assert.equal(st.checkOutBefore, "11:00 AM");
  assert.equal(st.hotelPhone, "+1 212 555 0100");
  assert.equal(st.hotelEmail, null);
  assert.equal(st.keyCollection, "Front desk closes at 10 PM; keys in lockbox after.");
  assert.deepEqual(st.conditions.map((c) => c.title), ["Check-in", "Important information", "Pets"]);
});

test("liteBreakdown splits only taxes LiteAPI says are included", () => {
  const rt = {
    offerRetailRate: { currency: "USD" },
    rates: [
      { retailRate: { taxesAndFees: [
        { included: true, amount: 30 },
        { included: false, amount: 25, description: "Resort fee" },
      ] } },
    ],
  };
  assert.deepEqual(liteBreakdown(rt, 230), { base: 200, taxesAndFees: 30, currency: "USD" });
  assert.equal(liteBreakdown({ rates: [] }, 230), null);
});
