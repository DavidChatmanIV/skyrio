import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Passenger subdocument ──
// Matches exactly what bookings.routes.js POST / builds into `passengers`.
const passengerSchema = new Schema(
  {
    name: { type: String },
    type: {
      type: String,
      enum: ["adult", "child", "infant_without_seat", "infant_with_seat"],
      default: "adult",
    },
    dob: { type: Date },
    phone: { type: String },
    knownTravelerNumber: { type: String },
  },
  { _id: false }
);

// ── Add-ons subdocument ──
// Matches safeAddOns built in bookings.routes.js POST /.
const addOnsSchema = new Schema(
  {
    seatTier: { type: String, default: "none" },
    seatPrice: { type: Number, default: 0 },
    bagOption: { type: String, default: "none" },
    bagPrice: { type: Number, default: 0 },
    insurance: { type: Boolean, default: false },
    insurancePrice: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Dates subdocument ──
// Referenced as dates.start / dates.end throughout routes/emails.
const datesSchema = new Schema(
  {
    start: { type: Date },
    end: { type: Date },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Primary contact — pulled from first passenger on creation.
    name: { type: String },
    email: { type: String },

    tripDetails: { type: String, required: true },

    type: {
      type: String,
      enum: ["Flight", "Hotel", "Package", "Place", "Cruise", "Car"],
      required: true,
    },

    // Flight is embedded directly (not a ref) — confirmed by the
    // "Removed .populate('flight')" comment in bookings.routes.js,
    // which explicitly says flight has no `ref` in the schema.
    flight: { type: Schema.Types.Mixed },

    // Hotel, package, and place ARE populated in the routes file
    // (.populate("hotel"), .populate("package"), .populate("place")),
    // so they must be ObjectId refs to their respective models.
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel" },
    package: { type: Schema.Types.ObjectId, ref: "Package" },
    place: { type: Schema.Types.ObjectId, ref: "Place" },

    dates: { type: datesSchema, default: () => ({}) },

    // Headcount — routes.js explicitly separates this Number from the
    // `passengers` array of actual people (see FIX comment in POST /).
    travelers: { type: Number, default: 1, min: 1 },

    passengers: { type: [passengerSchema], default: [] },

    addOns: { type: addOnsSchema, default: () => ({}) },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      index: true,
    },

    // Referenced in admin.routes.js dashboard aggregation
    // ($group by status, $sum total) and in growth-metrics cancellation
    // rate — required for revenue reporting to function.
    total: { type: Number, default: 0 },

    // Referenced in admin dashboard's recentBookings select().
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Avoid OverwriteModelError in dev/hot-reload.
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
