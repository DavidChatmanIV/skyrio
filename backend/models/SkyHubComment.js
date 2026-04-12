import mongoose from "mongoose";

const skyHubCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkyHubPost",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    authorName: {
      type: String,
      default: "Traveler",
      trim: true,
    },
    username: {
      type: String,
      default: "traveler",
      trim: true,
    },
    avatar: {
      type: String,
      default: "TR",
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SkyHubComment", skyHubCommentSchema);