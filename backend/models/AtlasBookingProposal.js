// backend/models/AtlasBookingProposal.js
// A booking Atlas has priced and prebooked but NOT paid for.
// Only the user tapping "Confirm & Pay" can turn one into a real booking.
import mongoose from "mongoose";

const PROPOSAL_TTL_MIN = 12; // LiteAPI offers die at ~13-15 min; stay under that

const AtlasBookingProposalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["flight", "hotel"], required: true },

    // Sync Together: when set, this proposal is the user's OWN share of a group trip
    syncTrip: { type: mongoose.Schema.Types.ObjectId, ref: "SyncGroup", default: null },
    sharedRoomId: { type: String, default: null }, // for shared hotel rooms

    // Provider handles (server-side only, never sent to the model)
    offerId: String,
    prebookId: { type: String, required: true },

    // Who is traveling — ids into the user's saved traveler profiles, resolved server-side
    travelerIds: [{ type: String }],

    // Exactly what the card shows and what gets charged
    summary: {
      title: String,          // "EWR → MIA · Fri Nov 6"
      lines: [String],        // ["Spirit NK 1234 · 7:05a → 10:02a", "Seat 12C", "1 personal item"]
      cancellation: String,   // copy straight from provider policy, no paraphrased promises
    },
    // Normalized trip details Atlas learns from once it's booked (no personal data)
    learnSummary: { type: Object, default: null },

    amount: { type: Number, required: true }, // minor units (cents)
    currency: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "processing", "requires_action", "booked", "expired", "price_changed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentIntentId: String,
    bookingRef: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    failureReason: String,

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + PROPOSAL_TTL_MIN * 60 * 1000),
    },
  },
  { timestamps: true }
);

// Clean up stale proposals a day after they expire (keeps an audit trail briefly)
AtlasBookingProposalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

AtlasBookingProposalSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt.getTime();
};

export default mongoose.model("AtlasBookingProposal", AtlasBookingProposalSchema);
