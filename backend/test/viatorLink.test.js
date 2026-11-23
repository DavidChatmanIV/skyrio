import { test } from "node:test";
import assert from "node:assert/strict";
process.env.VIATOR_SANDBOX_KEY ||= "test";
const { publicViatorUrl } = await import("../routes/api/excursions/excursions.utils.js");

test("Viator test-shop links open the public page for the same tour", () => {
  assert.equal(
    publicViatorUrl("https://shop.live.rc.viator.com/tours/Miami/Cruise/d662-1234P1?mcid=42383&pid=P1"),
    "https://www.viator.com/tours/Miami/Cruise/d662-1234P1?mcid=42383&pid=P1"
  );
  assert.equal(publicViatorUrl("https://www.viator.com/tours/x"), "https://www.viator.com/tours/x");
  assert.equal(publicViatorUrl("https://example.com/x"), "https://example.com/x");
  assert.equal(publicViatorUrl("not a url"), null);
});
