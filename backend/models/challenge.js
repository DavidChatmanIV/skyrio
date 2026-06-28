import mongoose from "mongoose";

const { Schema } = mongoose;

// A Challenge is data, not code — the whole point of building it this way
// is that David can create, edit, retheme, or end any challenge live via
// the API below, with zero deploys. requirement.actionType matches one of
// the existing keys in backend/config/xpRules.js (XP_RULES or XP_PASSIVE) —
// e.g. "BOOKING_CONFIRMED", "POST_CREATED", "SAVED_TRIP", "REFER_FRIEND".
// Reusing those same action keys means Challenges rides on top of XP
// tracking that's already correct, instead of becoming a sixth
// independent system that can drift out of sync with everything else.
const ChallengeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    // Free-text grouping/theming for display only (e.g. "football",
    // "worldcup", "general") — has zero effect on tracking logic.
    theme: { type: String, default: "general", trim: true },
    icon: { type: String, default: "🏆" },

    requirement: {
      actionType: { type: String, required: true },
      count: { type: Number, required: true, min: 1 },
    },

    bonusXP: { type: Number, required: true, min: 0 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Quick on/off switch — set false to pull a challenge immediately
    // without deleting it (and without losing anyone's progress record).
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ChallengeSchema.index({ active: 1, startDate: 1, endDate: 1 });

const Challenge =
  mongoose.models.Challenge || mongoose.model("Challenge", ChallengeSchema);
export default Challenge;
