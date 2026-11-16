import mongoose from "mongoose";

const skyHubCommentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "SkyHubPost", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    authorName: { type: String, default: "Traveler", trim: true },
    username: { type: String, default: "traveler", trim: true },
    avatar: { type: String, default: "TR" },
    text: { type: String, required: true, trim: true, maxlength: 600 },
    // A reply to another comment on the same post (one level, like
    // Instagram). Replies to a reply attach to the top comment.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "SkyHubComment", default: null, index: true },
    // Who liked this comment (the post's author liking it shows "Liked by author").
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    // Hidden by an admin (or after several reports) — kept for the record.
    hidden: { type: Boolean, default: false },
    hiddenReason: { type: String, enum: [null, "review", "removed"], default: null },
    reportCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.SkyHubComment || mongoose.model("SkyHubComment", skyHubCommentSchema);
