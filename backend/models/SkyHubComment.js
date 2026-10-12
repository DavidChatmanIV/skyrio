import mongoose from "mongoose";

const skyHubCommentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "SkyHubPost", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    authorName: { type: String, default: "Traveler", trim: true },
    username: { type: String, default: "traveler", trim: true },
    avatar: { type: String, default: "TR" },
    text: { type: String, required: true, trim: true, maxlength: 600 },
    // Hidden by an admin (or after several reports) — kept for the record.
    hidden: { type: Boolean, default: false },
    hiddenReason: { type: String, enum: [null, "review", "removed"], default: null },
    reportCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.SkyHubComment || mongoose.model("SkyHubComment", skyHubCommentSchema);
