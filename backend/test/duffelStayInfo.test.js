import { test } from "node:test";
import assert from "node:assert/strict";
import { stayInfoOf, hhmmTo12h } from "../providers/duffel/stays.js";

test("hhmmTo12h reads Duffel's HH:MM times", () => {
  assert.equal(hhmmTo12h("14:30"), "2:30 PM");
  assert.equal(hhmmTo12h("00:00"), "12:00 AM");
  assert.equal(hhmmTo12h("11:00"), "11:00 AM");
  assert.equal(hhmmTo12h(""), null);
  assert.equal(hhmmTo12h("25:00"), null);
});

test("stayInfoOf maps check-in times, contact, conditions and price split", () => {
  const acc = {
    phone_number: "+442074938181",
    email: "hotel@example.com",
    check_in_information: {
      check_in_after_time: "14:30",
      check_in_before_time: "00:00",
      check_out_before_time: "11:30",
    },
  };
  const rate = {
    total_currency: "GBP",
    base_amount: "665.83",
    tax_amount: "82.23",
    fee_amount: "50.94",
    conditions: [{ title: "Parking", description: "Public parking nearby" }],
  };
  const st = stayInfoOf(acc, rate);
  assert.equal(st.checkInAfter, "2:30 PM");
  assert.equal(st.checkOutBefore, "11:30 AM");
  assert.equal(st.hotelPhone, "+442074938181");
  assert.equal(st.hotelEmail, "hotel@example.com");
  assert.deepEqual(st.conditions, [{ title: "Parking", text: "Public parking nearby" }]);
  assert.deepEqual(st.breakdown, { base: 665.83, tax: 82.23, fee: 50.94, currency: "GBP" });
});

test("stayInfoOf never makes anything up when Duffel sends nothing", () => {
  const st = stayInfoOf({}, {});
  assert.equal(st.checkInAfter, null);
  assert.equal(st.checkOutBefore, null);
  assert.equal(st.hotelPhone, null);
  assert.deepEqual(st.conditions, []);
  assert.equal(st.breakdown, null);
});
