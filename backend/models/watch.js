import mongoose from "mongoose";

const WatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, default: "flights" },
    destination: { type: String, default: "" },
    dates: { type: [String], default: null },
    guests: { type: String, default: "" },
    lastSeenPrice: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

WatchSchema.index(
  { userId: 1, type: 1, destination: 1, guests: 1, dates: 1, active: 1 },
  { unique: false }
);

export default mongoose.model("Watch", WatchSchema);
