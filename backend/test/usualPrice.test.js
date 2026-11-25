// "Usual price on Skyrio": only from enough of Skyrio's own past fares,
// and "lower than usual" only for a clear dip.
import { test } from "node:test";
import assert from "node:assert/strict";
const { usualFrom, isLowerThanUsual, MIN_DAYS } = await import("../services/usualPrice.js");

const days = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test("nothing is said until there are 2 weeks of prices", () => {
  assert.equal(usualFrom(days(MIN_DAYS - 1, () => 200)), null);
  assert.ok(usualFrom(days(MIN_DAYS, () => 200)));
});

test("usual range is the middle half of past prices", () => {
  // 180..330 in steps of ~10 over 16 days
  const u = usualFrom(days(16, (i) => 180 + i * 10));
  assert.equal(u.days, 16);
  assert.equal(u.low, 218);
  assert.equal(u.high, 293);
  assert.equal(u.median, 255);
});

test("lower than usual only for a clear dip", () => {
  const u = { low: 218, high: 293, median: 255 };
  assert.equal(isLowerThanUsual(190, u), true); // under the range and >10% under median
  assert.equal(isLowerThanUsual(225, u), false); // inside the range
  assert.equal(isLowerThanUsual(217, u), true);
  assert.equal(isLowerThanUsual(190, { low: 200, high: 210, median: 205 }), false); // only ~7% under median
  assert.equal(isLowerThanUsual(190, null), false);
});
