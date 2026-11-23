import { test } from "node:test";
import assert from "node:assert/strict";
import { roomKindOf } from "../utils/roomKind.js";

test("room kinds from real-looking room names", () => {
  assert.equal(roomKindOf("Bed in 6-Bed Female Dormitory Room"), "female_dorm");
  assert.equal(roomKindOf("Female Only Room"), "female_dorm");
  assert.equal(roomKindOf("Women's 8 Bed Dorm"), "female_dorm");
  assert.equal(roomKindOf("Male Dormitory - 4 beds"), "male_dorm");
  assert.equal(roomKindOf("Bed in 4-Bed Mixed Dormitory Room"), "mixed_dorm");
  assert.equal(roomKindOf("Mixed Dorm"), "mixed_dorm");
  assert.equal(roomKindOf("Standard King Room"), "private");
  assert.equal(roomKindOf("Private Double Room with Shared Bathroom", "Generator Hostel"), "private");
  assert.equal(roomKindOf("Deluxe Room", "Generator Hostel"), "unknown");
  assert.equal(roomKindOf("Superior Room, 1 King Bed"), "private");
  // "female" must not count as male; "Women" must not count as "men".
  assert.equal(roomKindOf("Female dorm"), "female_dorm");
  assert.equal(roomKindOf("Women only dorm"), "female_dorm");
});

import { roomAllowed } from "../utils/roomKind.js";
test("Atlas never picks a female-only or male-only dorm unless asked", () => {
  assert.equal(roomAllowed("private"), true);
  assert.equal(roomAllowed("mixed_dorm"), true);
  assert.equal(roomAllowed("female_dorm"), false);
  assert.equal(roomAllowed("male_dorm"), false);
  assert.equal(roomAllowed("female_dorm", "female"), true);
  assert.equal(roomAllowed("male_dorm", "female"), false);
  assert.equal(roomAllowed("male_dorm", "male"), true);
});
