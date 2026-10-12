import mongoose from "mongoose";

// blocker never sees blocked's posts or comments, and vice versa.
const skyHubBlockSchema = new mongoose.Schema(
  {
    blocker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    blocked: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);
skyHubBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export default mongoose.models.SkyHubBlock || mongoose.model("SkyHubBlock", skyHubBlockSchema);
