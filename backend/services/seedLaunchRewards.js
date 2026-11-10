// One-time: set up the launch rewards catalog.
//
//   node scripts/seedLaunchRewards.js            (dry run: shows what it would do)
//   node scripts/seedLaunchRewards.js --apply    (does it)
//
// 1. Turns OFF the old placeholder rewards (weekend_xp, review_streak,
//    globetrotter, priority_support, wc_jacket). Soft-off only (active:
//    false), so anyone who redeemed one keeps it in their history.
// 2. Adds the launch rewards, also OFF. (The two membership rewards are
//    delivered by services/rewardFulfillment.js as a Stripe credit, so
//    those can be turned on as soon as it's deployed and tested.) Turn each one on from the admin
//    rewards screen (or PATCH /api/rewards/items/:itemId { active: true })
//    only once it really delivers what it says. A reward people can spend
//    XP on but never receive would be misleading.
//
// Safe to run twice: existing items are updated by itemId, never duplicated,
// and an item you already turned on stays on.

import "dotenv/config";
import mongoose from "mongoose";
import RewardItem from "../models/rewardItem.js";

const RETIRE = [
  "weekend_xp",
  "review_streak",
  "globetrotter",
  "priority_support",
  "wc_jacket",
];

// Costs are set against the real earn rates in config/xpRules.js:
// a booking is 150 XP (+50 first booking, +75 first international),
// a referral 60, SkyHub/visits at most 100 a week.
const LAUNCH = [
  {
    itemId: "golden_hour_cover",
    type: "PERK",
    title: "Golden Hour Passport cover",
    desc: "A warm sunset cover for your Digital Passport.",
    cost: 400, // about 2 trips, or a month of daily SkyHub
    level: 1,
    featured: true,
    repeatable: false,
    isNewItem: true,
  },
  {
    itemId: "seasoned_frame",
    type: "BADGE",
    title: "Seasoned Traveler frame",
    desc: "A gold frame on every postcard you post to SkyHub.",
    cost: 700, // 3–4 trips
    level: 1,
    featured: false,
    repeatable: false,
    isNewItem: true,
  },
  {
    itemId: "explorer_month",
    type: "PERK",
    title: "1 month of Skyrio Explorer",
    desc: "A membership credit for one free month of Explorer. 1.5x XP on everything you earn.",
    cost: 1200, // about 6 trips
    level: 1,
    featured: false,
    repeatable: false,
    isNewItem: true,
  },
  {
    itemId: "legend_3_months",
    type: "LIMITED",
    title: "3 months of Skyrio Legend",
    desc: "A membership credit for three free months of Legend. 2.5x XP on everything you earn.",
    cost: 3000, // frequent travelers only
    level: 1,
    featured: false,
    repeatable: false,
    isNewItem: true,
  },
];

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

await mongoose.connect(uri, {
  dbName: process.env.MONGODB_DB || process.env.MONGO_DB || undefined,
});
console.log(apply ? "APPLYING changes\n" : "DRY RUN (add --apply to save)\n");

for (const itemId of RETIRE) {
  const it = await RewardItem.findOne({ itemId }).lean();
  if (!it) {
    console.log(`  skip   ${itemId} (not in the database)`);
    continue;
  }
  console.log(
    `  off    ${itemId}${it.active === false ? " (already off)" : ""}`
  );
  if (apply)
    await RewardItem.updateOne({ itemId }, { $set: { active: false } });
}

for (const item of LAUNCH) {
  const it = await RewardItem.findOne({ itemId: item.itemId }).lean();
  if (it) {
    console.log(
      `  update ${item.itemId} (keeps active: ${it.active !== false})`
    );
    if (apply) {
      const { itemId, ...fields } = item;
      await RewardItem.updateOne({ itemId }, { $set: fields });
    }
  } else {
    console.log(`  add    ${item.itemId} (off until it delivers)`);
    if (apply) await RewardItem.create({ ...item, active: false });
  }
}

await mongoose.disconnect();
console.log("\nDone.");
