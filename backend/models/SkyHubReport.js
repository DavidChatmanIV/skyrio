import mongoose from "mongoose";

// One report from one person about a post, comment or traveler.
// The admin "SkyHub reports" queue reads from here.
const skyHubReportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["post", "comment", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "SkyHubPost", default: null },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: {
      type: String,
      enum: ["spam", "harassment", "hate", "nudity", "scam", "violence", "misinformation", "other"],
      default: "other",
    },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["open", "dismissed", "actioned"], default: "open", index: true },
    resolution: { type: String, default: null }, // dismissed | hidden | removed | suspended
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One report per person per thing.
skyHubReportSchema.index({ targetType: 1, targetId: 1, reporter: 1 }, { unique: true });

export default mongoose.models.SkyHubReport || mongoose.model("SkyHubReport", skyHubReportSchema);
