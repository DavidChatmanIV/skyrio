// backend/models/XpTransaction.js
// XP ledger: every earn (+) and spend (-). If you already log XP grants
// (referrals/challenges), point the services at that model instead.
import mongoose from "mongoose";

const xpTransactionSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount:   { type: Number, required: true },            // + earned, - spent
    kind:     { type: String, enum: ["earn", "spend"], required: true },
    reason:   { type: String, required: true },            // "booking", "review", "redeem:weekend-multiplier"...
    refId:    { type: mongoose.Schema.Types.ObjectId },    // booking / reward / challenge id
    reversed: { type: Boolean, default: false },           // true after a cancelled booking
  },
  { timestamps: true }
);

// One earn per booking/challenge — stops double-granting
xpTransactionSchema.index({ user: 1, refId: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: "earn" } });

export default mongoose.models.XpTransaction || mongoose.model("XpTransaction", xpTransactionSchema);
