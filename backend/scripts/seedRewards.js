// One-time migration: carries the 5 items that used to live in
// rewards.routes.js's hardcoded REWARDS_CATALOG (cost, repeatable, title)
// merged with PassportRewards.jsx's hardcoded DEFAULT_ITEMS (type, desc,
// level, featured, isNew) into the new RewardItem collection — so the
// catalog looks identical to users the moment this deploys, instead of
// suddenly being empty until someone manually recreates all 5 by hand.
//
// Safe to run more than once: uses upsert keyed on itemId, so re-running
// it just confirms the data matches instead of creating duplicates.
//
// ⚠️ Uses process.env.MONGO_URI below — I haven't seen server.js's actual
// connection code, so double check that's the real env var name your app
// uses before running this; adjust if it's actually MONGODB_URI or
// something else.
//
// Run once with: node scripts/seedRewards.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import RewardItem from "../models/rewardItem.js";

dotenv.config();

const SEED_ITEMS = [
  {
    itemId: "weekend_xp",
    title: "Weekend XP Multiplier",
    desc: "+2x XP on all bookings Fri–Sun",
    type: "BOOST",
    cost: 250,
    level: 1,
    featured: true,
    repeatable: true,
    isNewItem: false,
  },
  {
    itemId: "review_streak",
    title: "Review Streak (+1.5x)",
    desc: "Leave 3 verified reviews this month for extra XP.",
    type: "BADGE",
    cost: 180,
    level: 1,
    featured: false,
    repeatable: false,
    isNewItem: false,
  },
  {
    itemId: "globetrotter",
    title: "Globetrotter",
    desc: "Unlocked at higher tiers or buy to fast-track.",
    type: "BADGE",
    cost: 400,
    level: 3,
    featured: false,
    repeatable: false,
    isNewItem: true,
  },
  {
    itemId: "priority_support",
    title: "Priority Support Week",
    desc: "Jump the queue on Atlas AI escalations for 7 days.",
    type: "PERK",
    cost: 150,
    level: 1,
    featured: false,
    repeatable: true,
    isNewItem: false,
  },
  {
    itemId: "wc_jacket",
    title: "Skyrio World Cup Jacket — Numbered Drop",
    desc: "Limited 50-unit run. Redeem XP toward your unit.",
    type: "LIMITED",
    cost: 1200,
    level: 5,
    featured: false,
    repeatable: false,
    isNewItem: false,
  },
];

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error(
      "❌ process.env.MONGO_URI is not set — check your actual env var name in server.js and adjust this script before running."
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  for (const item of SEED_ITEMS) {
    const result = await RewardItem.findOneAndUpdate(
      { itemId: item.itemId },
      { $set: item },
      { upsert: true, new: true }
    );
    console.log(`✅ ${result.itemId} — "${result.title}" (${result.cost} XP)`);
  }

  console.log(`\nDone. ${SEED_ITEMS.length} items seeded/confirmed.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
