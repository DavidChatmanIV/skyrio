import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    // Not required: collapsed notifications (group chat, likes, comments)
    // are created first, then given their text in a second step.
    message: {
      type: String,
      default: "",
      trim: true,
    },
    link: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },

    // What the notification points at (sync trip, post, booking...)
    targetType: {
      type: String,
      default: "",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Collapsing — used by backend/utils/notify.js
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SyncGroup", // change to your Sync Together model name
    },
    count: {
      type: Number,
      default: 1,
    },
    senders: {
      type: [String],
      default: [],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Feed + unread count lookups
notificationSchema.index({ user: 1, read: 1, updatedAt: -1 });
// The one open (unread) group-chat notification to collapse into
notificationSchema.index({ user: 1, type: 1, group: 1, read: 1 });
// The one open like/comment notification per post
notificationSchema.index({ user: 1, type: 1, targetId: 1, read: 1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
