import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

/**
 * XpLedger — one row per XP grant.
 * Purpose: idempotency (nothing pays twice), pending booking XP, reversals, audit trail.
 * User.xp stays the live balance (updated atomically alongside the ledger),
 * so existing users keep their current XP — no migration needed.
 */
const xpLedgerSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    ruleKey: { type: String, required: true }, // key from XP_RULES / XP_PASSIVE
    sourceType: { type: String, default: null }, // "Booking" | "Post" | "Comment" | "Referral" | ...
    sourceId: { type: String, required: true }, // booking id, post id, day key, "once", ...
    // What this XP depends on. Cancelling/deleting that thing reverses every row linked to it.
    // e.g. FIRST_BOOKING and REFER_FRIEND both link to the booking that earned them.
    linkedTo: { type: String, default: null, index: true },
    actorId: { type: ObjectId, ref: "User", default: null }, // e.g. who liked the post
    amount: { type: Number, required: true, min: 0 }, // final amount after multiplier
    status: {
      type: String,
      enum: ["pending", "confirmed", "reversed"],
      default: "confirmed",
      index: true,
    },
    confirmAfter: { type: Date, index: true },
    reversedAt: Date,
    reason: String,
  },
  { timestamps: true }
);

// The same rule on the same thing by the same actor pays ONCE, ever.
// Reversed rows stay, so unlike → re-like or delete → re-share can't re-earn.
xpLedgerSchema.index(
  { user: 1, ruleKey: 1, sourceId: 1, actorId: 1 },
  { unique: true }
);
xpLedgerSchema.index({ ruleKey: 1, linkedTo: 1 });

/** Atomic cap counters (daily / weekly / per-post). Auto-deleted after ~9 days. */
const xpCounterSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: "User", required: true },
  bucket: { type: String, required: true },
  total: { type: Number, default: 0 },
  expiresAt: { type: Date },
});
xpCounterSchema.index({ user: 1, bucket: 1 }, { unique: true });
xpCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const XpLedger =
  mongoose.models.XpLedger || mongoose.model("XpLedger", xpLedgerSchema);
export const XpCounter =
  mongoose.models.XpCounter || mongoose.model("XpCounter", xpCounterSchema);
