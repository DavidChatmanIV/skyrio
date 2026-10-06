// backend/models/FlightCheckoutSession.js
// Server is the source of truth for prebookId + the LATEST transactionId.
// The client only ever holds a sessionId and the payment form's secretKey.

import mongoose from "mongoose";

const flightCheckoutSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    offerId: String,
    prebookId: { type: String, index: true },
    transactionId: String, // overwritten after every attach-services call
    total: Number,
    currency: String,
    contact: Object,
    passengers: Array,
    selectedServices: Array,
    status: {
      type: String,
      enum: ["PREBOOKED", "BOOKING", "BOOKED", "FAILED"],
      default: "PREBOOKED",
    },
    bookingId: String,
    bookingRef: String, // airline PNR
    error: String,
    raw: Object,
  },
  { timestamps: true }
);

export default mongoose.models.FlightCheckoutSession ||
  mongoose.model("FlightCheckoutSession", flightCheckoutSessionSchema);
