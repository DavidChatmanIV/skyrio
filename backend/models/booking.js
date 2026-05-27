import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // ── Core identity ──
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    name: { type: String },
    email: { type: String },

    // ── Trip info ──
    tripDetails: { type: String, required: true },
    type: {
      type: String,
      enum: ["Flight", "Hotel", "Package", "Car"],
      required: true,
    },
    destination: { type: String },
    destinationCity: { type: String },
    destinationCountry: { type: String },
    date: { type: Date, default: Date.now },

    // ── Booking lifecycle ──
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "switched"],
      default: "pending",
      index: true,
    },

    // ── Travel dates (used by Atlas to check if trip is upcoming/past) ──
    dates: {
      start: { type: Date },
      end: { type: Date },
    },
    travelers: { type: Number, default: 1 },

    // ── Flight data (populated from Duffel) ──
    flight: {
      duffelOrderId: { type: String, index: true },
      offerId: { type: String },
      owner: { type: String }, // airline name
      airline: { type: String }, // alias
      origin: { type: String }, // IATA code
      destination: { type: String }, // IATA code
      departingAt: { type: Date },
      arrivingAt: { type: Date },
      stops: { type: Number },
      cabin: { type: String },
      totalAmount: { type: String },
      totalCurrency: { type: String, default: "USD" },
      segments: [mongoose.Schema.Types.Mixed],
    },

    // ── Hotel data ──
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
    },

    // ── Package / Place refs ──
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    place: { type: mongoose.Schema.Types.ObjectId, ref: "Place" },

    // ── Car rental data ──
    car: {
      provider: { type: String },
      vehicleType: { type: String },
      pickupLocation: { type: String },
      dropoffLocation: { type: String },
      pickupDate: { type: Date },
      dropoffDate: { type: Date },
      totalAmount: { type: Number },
      totalCurrency: { type: String, default: "USD" },
      confirmationCode: { type: String },
    },

    // ── Payment tracking (Stripe) ──
    stripePaymentIntentId: { type: String, index: true },
    paymentIntentId: { type: String },
    totalAmount: { type: Number },
    totalCurrency: { type: String, default: "USD" },
    paidAt: { type: Date },

    // ── Cancellation tracking ──
    cancelledAt: { type: Date },
    cancellationReason: { type: String },

    // ── Refund tracking ──
    refundId: { type: String },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "succeeded", "failed"],
      default: "none",
    },
    refundAmount: { type: Number },
    refundedAt: { type: Date },

    // ── Switch tracking (when user changes to a different flight) ──
    switchedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    switchedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  },
  { timestamps: true }
);

// ── Indexes for Atlas queries ──
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ user: 1, "dates.start": 1 });
bookingSchema.index({ "flight.duffelOrderId": 1 });

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
