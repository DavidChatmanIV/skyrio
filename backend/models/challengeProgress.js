import mongoose from "mongoose";

const { Schema } = mongoose;

// Tracks one user's progress on one challenge. Kept separate from
// Challenge itself (rather than an embedded participants array) so this
// collection can grow to any size without bloating the Challenge document
// every active user is reading.
const ChallengeProgressSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challenge: {
      type: Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
      index: true,
    },
    activatedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    bonusAwarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One progress record per user per challenge — activating twice just
// returns the existing record rather than creating a duplicate.
ChallengeProgressSchema.index({ user: 1, challenge: 1 }, { unique: true });

const ChallengeProgress =
  mongoose.models.ChallengeProgress ||
  mongoose.model("ChallengeProgress", ChallengeProgressSchema);
export default ChallengeProgress;
