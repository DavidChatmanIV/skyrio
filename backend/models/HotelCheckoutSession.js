// backend/models/HotelCheckoutSession.js
// Tracks one hotel checkout (Skyrio = merchant of record via Stripe manual capture).
// Kept separate from models/booking.js on purpose: that schema has strict enums,
// and a validation error AFTER charging a card is the worst possible crash.

import mongoose from "mongoose";

const hotelCheckoutSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    offerId: String,
    prebookId: { type: String, index: true },
    paymentIntentId: { type: String, unique: true, sparse: true },
    total: Number, // what the traveler pays (net + markup)
    netPrice: Number, // what LiteAPI charges Skyrio
    currency: String,
    holder: Object,
    guests: Array,
    status: {
      type: String,
      enum: ["PENDING", "BOOKING", "BOOKED", "FAILED", "NEEDS_RECONCILE"],
      default: "PENDING",
    },
    providerBookingId: String,
    hotelConfirmationCode: String,
    error: String,
    raw: Object,
  },
  { timestamps: true }
);

export default mongoose.models.HotelCheckoutSession ||
  mongoose.model("HotelCheckoutSession", hotelCheckoutSessionSchema);
