// backend/models/DuffelFlightCheckout.js
// One Duffel flight checkout: the Stripe hold, the travelers to book, and
// what happened. Mirrors HotelCheckoutSession for hotels.
import mongoose from "mongoose";

const DuffelFlightCheckoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = guest
    email: { type: String, lowercase: true, trim: true },
    offerId: { type: String, required: true },
    paymentIntentId: { type: String, required: true, unique: true },
    // What the traveler is charged (Skyrio price) vs what Duffel is paid.
    sellAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    // Travelers exactly as Duffel's create-order expects them.
    orderPassengers: { type: Array, default: [] },
    groupId: { type: String, default: null },
    status: {
      type: String,
      enum: ["PENDING", "BOOKING", "BOOKED", "FAILED", "NEEDS_RECONCILE"],
      default: "PENDING",
    },
    duffelOrderId: { type: String, default: null },
    bookingReference: { type: String, default: null }, // airline PNR
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.DuffelFlightCheckout ||
  mongoose.model("DuffelFlightCheckout", DuffelFlightCheckoutSchema);
