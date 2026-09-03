import mongoose from "mongoose";

const { Schema } = mongoose;

// One share = one payer's slice of a group booking. `member` links back
// to the SyncGroup member subdocument's _id (used by PaymentProgressPanel
// to match rows) and is null for the owner's own share, since the owner
// isn't in group.members. `user`/`email`/`name` are copied at creation
// time so a share is still identifiable even if the member is later
// removed from the group.
const ShareSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, default: null },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },

    // Stored in cents, matching how Stripe amounts are already handled
    // in stripe.routes.js (Math.round(amount * 100)).
    amountOwed: { type: Number, required: true },
    currency: { type: String, default: "usd" },

    status: {
      type: String,
      enum: ["unpaid", "paid", "failed"],
      default: "unpaid",
    },
    stripePaymentIntentId: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SplitPaymentSchema = new Schema(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: "SyncGroup",
      required: true,
      index: true,
    },
    shares: { type: [ShareSchema], default: [] },
  },
  { timestamps: true }
);

SplitPaymentSchema.methods.allPaid = function () {
  return (
    this.shares.length > 0 && this.shares.every((s) => s.status === "paid")
  );
};

const SplitPayment =
  mongoose.models.SplitPayment ||
  mongoose.model("SplitPayment", SplitPaymentSchema);

export default SplitPayment;
