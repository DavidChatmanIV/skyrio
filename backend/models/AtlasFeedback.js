// backend/models/AtlasFeedback.js
// Thumbs up/down on an Atlas reply. Used to adapt Atlas for this user,
// and gives you a list of where Atlas falls short so you can improve its instructions.
import mongoose from "mongoose";

export const FEEDBACK_REASONS = [
  "wrong_info",
  "didnt_understand",
  "bad_suggestions",
  "too_long",
  "too_many_questions",
  "too_slow",
  "other",
];

const AtlasFeedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    rating: { type: String, enum: ["up", "down"], required: true },
    reasons: [{ type: String, enum: FEEDBACK_REASONS }],
    comment: { type: String, maxlength: 500 },

    // Snapshot for your review. The reply only, never the user's own message.
    atlasReply: { type: String, maxlength: 4000 },
    toolsUsed: [String], // e.g. ["search_flights", "propose_booking"]

    xpAwarded: { type: Number, default: 0 },
    reviewed: { type: Boolean, default: false }, // you tick this off in the insights view
  },
  { timestamps: true }
);

// One rating per reply; changing your mind updates it
AtlasFeedbackSchema.index({ user: 1, messageId: 1 }, { unique: true });

export default mongoose.model("AtlasFeedback", AtlasFeedbackSchema);
