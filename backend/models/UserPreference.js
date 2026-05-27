/**
 * UserPreference.js
 * ─────────────────────────────────────────────────────────────
 * MongoDB model — stores everything Atlas learns about a user
 * across conversations.
 *
 * Drop into:  backend/models/UserPreference.js
 * ─────────────────────────────────────────────────────────────
 */

import mongoose from "mongoose";

const preferenceEntrySchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "travel_style",
        "accommodation",
        "flights",
        "food",
        "activities",
        "budget",
        "destinations",
        "logistics",
        "general",
      ],
      default: "general",
    },
    confidence: { type: Number, default: 0.8, min: 0, max: 1 },
    source: { type: String, default: "conversation" },
    extractedFrom: { type: String },
    supersedes: { type: String },
  },
  { timestamps: true }
);

const tripHistorySchema = new mongoose.Schema(
  {
    destination: String,
    dates: { start: Date, end: Date },
    budget: Number,
    travelers: Number,
    vibe: String,
    rating: { type: Number, min: 1, max: 5 },
    notes: String,
  },
  { timestamps: true }
);

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    preferences: [preferenceEntrySchema],
    tripHistory: [tripHistorySchema],
    profileSummary: { type: String, default: "" },
    stats: {
      totalConversations: { type: Number, default: 0 },
      totalMessages: { type: Number, default: 0 },
      firstSeen: { type: Date, default: Date.now },
      lastSeen: { type: Date, default: Date.now },
      topDestinations: [String],
      averageBudget: { type: Number },
    },
  },
  { timestamps: true }
);

userPreferenceSchema.index({ "preferences.category": 1 });
userPreferenceSchema.index({ "preferences.key": 1 });

userPreferenceSchema.methods.getByCategory = function (category) {
  return this.preferences.filter((p) => p.category === category);
};

userPreferenceSchema.methods.upsertPreference = function (entry) {
  const existing = this.preferences.find(
    (p) => p.key === entry.key && p.category === entry.category
  );
  if (existing) {
    existing.value = entry.value;
    existing.confidence = entry.confidence ?? existing.confidence;
    existing.extractedFrom = entry.extractedFrom || existing.extractedFrom;
    existing.updatedAt = new Date();
  } else {
    this.preferences.push(entry);
  }
};

const UserPreference = mongoose.model("UserPreference", userPreferenceSchema);
export default UserPreference;
