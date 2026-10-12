import mongoose from "mongoose";

// One strike against a traveler for breaking the SkyHub guidelines.
// Strikes count toward the penalty ladder until they expire (90 days by
// default) or are overturned on appeal.
const skyHubStrikeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: {
      type: String,
      enum: ["spam", "harassment", "hate", "nudity", "scam", "violence", "misinformation", "other"],
      default: "other",
    },
    severity: { type: String, enum: ["standard", "severe"], default: "standard" },
    note: { type: String, trim: true, maxlength: 500, default: "" }, // shown to the traveler
    targetType: { type: String, enum: ["post", "comment", "user", null], default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    snippet: { type: String, maxlength: 300, default: "" }, // what they wrote (for their records)
    // What this strike caused
    action: { type: String, enum: ["warning", "suspension", "ban"], required: true },
    suspensionDays: { type: Number, default: 0 },
    strikeNumber: { type: Number, default: 1 }, // active strikes including this one
    by: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: true },
    voided: { type: Boolean, default: false }, // overturned on appeal
    appeal: {
      status: { type: String, enum: ["none", "pending", "approved", "denied"], default: "none" },
      message: { type: String, trim: true, maxlength: 1000, default: "" },
      at: { type: Date, default: null },
      response: { type: String, trim: true, maxlength: 1000, default: "" },
      resolvedBy: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

skyHubStrikeSchema.index({ "appeal.status": 1, createdAt: -1 });

export default mongoose.models.SkyHubStrike || mongoose.model("SkyHubStrike", skyHubStrikeSchema);
