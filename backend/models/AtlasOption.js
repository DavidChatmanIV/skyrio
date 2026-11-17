// backend/models/AtlasOption.js
// The search results Atlas showed in a chat (flights, hotels, cars), kept
// for as long as their prices last (~13 minutes), so "book option 2" or a
// price check still works after the server restarts or redeploys, or when
// the next message reaches a different server.
//
// Only what the search returned: no traveler names, birthdays or payment.
// `data` is the cached entry as JSON text (provider payloads can have keys
// Mongo won't store as-is).
import mongoose from "mongoose";

const AtlasOptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // optionId, or "group:<searchId>"
    owner: { type: String, required: true },
    data: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

// Mongo deletes them once they expire.
AtlasOptionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AtlasOption || mongoose.model("AtlasOption", AtlasOptionSchema);
