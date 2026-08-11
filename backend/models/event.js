import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      "destination_viewed",
      "guide_generated",
      "booking_completed",
      "trip_completed",
      "login",
      "search_performed",
      "dormancy_email_sent",
    ],
    index: true,
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
});

eventSchema.index({ userId: 1, timestamp: -1 });
eventSchema.index({ eventType: 1, timestamp: -1 });

export default mongoose.model("Event", eventSchema);
