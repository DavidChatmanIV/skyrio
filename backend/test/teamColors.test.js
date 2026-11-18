// Team Colors cover: only real colors and known sports get saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTeamColors, COVER_BY_ITEM, SEEDED_REWARDS } from "../config/passportCovers.js";

test("keeps two real colors and a known sport", () => {
  assert.deepEqual(cleanTeamColors({ primary: "#552583", secondary: "#fdb927", pattern: "court" }), {
    primary: "#552583",
    secondary: "#FDB927",
    pattern: "court",
  });
});

test("rejects anything that isn't a color; unknown sport becomes plain", () => {
  assert.equal(cleanTeamColors({ primary: "red", secondary: "#000000" }), null);
  assert.equal(cleanTeamColors({ primary: "#000000;}body{", secondary: "#000000" }), null);
  assert.equal(cleanTeamColors(null), null);
  assert.equal(cleanTeamColors({ primary: "#000000", secondary: "#FFFFFF", pattern: "<x>" }).pattern, "none");
});

test("the cover is a reward for every plan", () => {
  assert.equal(COVER_BY_ITEM.team_colors_cover, "team");
  const r = SEEDED_REWARDS.find((x) => x.itemId === "team_colors_cover");
  assert.ok(r && !r.minPlan && r.cost > 0);
});
