// backend/scripts/migratePassportXp.js
// Run ONCE:  node scripts/migratePassportXp.js
// Rebuilds lifetimeXp from everything a user ever earned, so ranks lost to redemptions come back.
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import XpTransaction from "../models/XpTransaction.js";
import { getRank } from "../utils/passportRanks.js";

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({}, "_id passport");
let updated = 0;

for (const u of users) {
  const [earned] = await XpTransaction.aggregate([
    { $match: { user: u._id, kind: "earn", reversed: false } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const oldXp = u.passport?.xp ?? 0;                      // ← your current XP field name
  const xpBalance = u.passport?.xpBalance ?? oldXp;
  const lifetimeXp = Math.max(earned?.total ?? 0, oldXp, xpBalance);

  await User.updateOne({ _id: u._id }, { $set: {
    "passport.lifetimeXp": lifetimeXp,
    "passport.xpBalance": xpBalance,
    "passport.rankKey": getRank(lifetimeXp).key,
  } });
  updated++;
  console.log(`${u._id}: lifetime ${lifetimeXp} · balance ${xpBalance} · ${getRank(lifetimeXp).name}`);
}

console.log(`Done — ${updated} users migrated.`);
await mongoose.disconnect();
