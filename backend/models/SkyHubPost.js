import mongoose from "mongoose";

const skyHubPostSchema = new mongoose.Schema(
  {
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
    verified: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["Travel Tip", "Question", "Story", "Photo Drop", "Join Trip"],
      default: "Story",
    },
    destination: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    image: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    budget: {
      type: String,
      default: "",
    },
    helpful: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: [String],
      default: [],
    },
    saves: {
      type: [String],
      default: [],
    },
    reports: {
      type: [
        {
          userId: String,
          reason: String,
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SkyHubPost", skyHubPostSchema);