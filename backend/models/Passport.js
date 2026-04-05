import mongoose from "mongoose";

const passportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    stats: {
      tripsSaved: { type: Number, default: 0 },
      tripsPlanned: { type: Number, default: 0 },
      bookingsMade: { type: Number, default: 0 },
    },
    badges: {
      type: [String],
      default: [],
    },
    journeyHistory: [
      {
        type: {
          type: String,
          required: true,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        xpEarned: {
          type: Number,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Passport", passportSchema);