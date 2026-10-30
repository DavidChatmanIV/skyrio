// backend/models/AtlasCheckoutHandoff.js
// When Atlas sends someone to the checkout page ("Review & pay"), this holds
// the offer they picked so the page can open straight on it.
//
// No personal details live here: just the offer, what Atlas showed, and the
// search (dates / how many travelers). Traveler names, birthdays and payment
// are entered on the checkout page itself, like any other checkout.
import mongoose from "mongoose";

const AtlasCheckoutHandoffSchema = new mongoose.Schema(
  {
    handoffId: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["flight", "hotel"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null for guests
    offerId: { type: String, required: true },
    offer: { type: mongoose.Schema.Types.Mixed, required: true }, // provider offer from search
    display: { type: mongoose.Schema.Types.Mixed, default: {} }, // what Atlas showed in chat
    search: { type: mongoose.Schema.Types.Mixed, default: {} }, // dates, adults, children, rooms
    openedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Mongo removes handoffs a day after they expire.
AtlasCheckoutHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const AtlasCheckoutHandoff =
  mongoose.models.AtlasCheckoutHandoff ||
  mongoose.model("AtlasCheckoutHandoff", AtlasCheckoutHandoffSchema);

export default AtlasCheckoutHandoff;
