// backend/models/AtlasLearnedPreference.js
// One thing Atlas has learned about a user, with where it came from and how sure Atlas is.
import mongoose from "mongoose";

export const LEARNING_CATEGORIES = [
  "flights",       // nonstop, morning departures, favorite airlines, seat
  "hotels",        // style, star level, must-haves like a pool or gym
  "budget",        // usual spend ranges
  "trip_style",    // beach, city, weekend trips, adventure
  "activities",    // excursions they like
  "travel_party",  // solo, with kids, with a group
  "food",          // dietary choices like vegetarian (not allergies)
  "communication", // how they like Atlas to talk: short replies, fewer questions
];

const AtlasLearnedPreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: LEARNING_CATEGORIES, required: true },

    // Stable key so repeat signals update one row instead of piling up,
    // e.g. "flight.nonstop", "flight.airline.B6", "hotel.nightly_range", "stated.<hash>"
    key: { type: String, required: true },

    text: { type: String, required: true, maxlength: 200 }, // plain words shown to the user and to Atlas

    // stated = user told Atlas · bookings = pattern from their trips
    // choices = pattern from options they picked · feedback = from their thumbs-down reasons
    source: { type: String, enum: ["stated", "bookings", "choices", "feedback"], required: true },

    evidenceCount: { type: Number, default: 1 },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    data: { type: Object, default: {} }, // numbers behind the pattern (counts, ranges)

    active: { type: Boolean, default: true }, // user can switch one off without deleting
    editedByUser: { type: Boolean, default: false }, // never overwrite a user's own edit
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AtlasLearnedPreferenceSchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model("AtlasLearnedPreference", AtlasLearnedPreferenceSchema);
