// Rebuilds User.xpTotalEarned (lifetime XP → rank) for accounts where it was never
// kept in sync. Lifetime = the HIGHEST of:
//   1. what's stored now (xpTotalEarned)
//   2. current balance + everything ever redeemed
//   3. sum of confirmed XP ledger rows
// It only ever RAISES xpTotalEarned — never lowers it.
//
// Dry run (changes nothing, just prints):
//   node scripts/backfillLifetimeXp.js --user=skyarchitect
// Apply for one user / everyone:
//   node scripts/backfillLifetimeXp.js --user=skyarchitect --apply
//   node scripts/backfillLifetimeXp.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/user.js";
import { XpLedger } from "../models/xpModels.js";
import { getLevel } from "../config/xpRules.js";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--user="))?.split("=")[1];

const uri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;
if (!uri) {
  console.error(
    "No Mongo connection string found in backend/.env (MONGO_URI / MONGODB_URI)."
  );
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

// Find wherever redemptions are stored (any collection with "redeem"/"redemption" in its name)
const redeemCols = (await db.listCollections().toArray())
  .map((c) => c.name)
  .filter((n) => /redeem|redemption/i.test(n));
console.log(
  `Redemption collections: ${redeemCols.join(", ") || "(none found)"}`
);
console.log(
  APPLY ? "MODE: APPLY (writing changes)\n" : "MODE: DRY RUN (no changes)\n"
);

const filter = ONLY
  ? { $or: [{ username: ONLY.toLowerCase() }, { email: ONLY.toLowerCase() }] }
  : {};
const users = await User.find(filter)
  .select("username email xp pendingXp xpTotalEarned")
  .lean();
if (!users.length) console.log("No matching users.");

const DEAD = /refund|cancel|fail|revers|void/i;
const costOf = (d) =>
  Math.abs(
    Number(d.cost ?? d.xpCost ?? d.xpSpent ?? d.costXp ?? d.amount ?? d.xp ?? 0)
  ) || 0;

let changed = 0;
for (const u of users) {
  const [led] = await XpLedger.aggregate([
    { $match: { user: u._id, status: "confirmed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const ledgerTotal = led?.total ?? 0;

  let redeemed = 0;
  const idMatch = [
    { user: u._id },
    { userId: u._id },
    { user: String(u._id) },
    { userId: String(u._id) },
  ];
  for (const col of redeemCols) {
    const docs = await db.collection(col).find({ $or: idMatch }).toArray();
    for (const d of docs)
      if (!DEAD.test(String(d.status || ""))) redeemed += costOf(d);
  }

  const stored = Number(u.xpTotalEarned ?? 0);
  const balance = Number(u.xp ?? 0);
  const lifetime = Math.max(stored, balance + redeemed, ledgerTotal);
  const rankNow = getLevel(stored || balance).current.name;
  const rankNew = getLevel(lifetime).current.name;

  console.log(
    `${
      u.username || u.email
    }: balance ${balance} · redeemed ${redeemed} · ledger ${ledgerTotal} · stored lifetime ${stored}` +
      `\n   → lifetime ${lifetime}  (${rankNow} → ${rankNew})`
  );

  if (lifetime > stored) {
    changed++;
    if (APPLY)
      await User.updateOne(
        { _id: u._id },
        { $set: { xpTotalEarned: lifetime } }
      );
  }
}

console.log(
  `\n${changed} user(s) ${
    APPLY ? "updated" : "would be updated — rerun with --apply"
  }.`
);
await mongoose.disconnect();
