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
    // LiteAPI hotel stays have no Hotel document — they use `hotelStay` below.
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel" },
    package: { type: Schema.Types.ObjectId, ref: "Package" },
    place: { type: Schema.Types.ObjectId, ref: "Place" },

    // ── LiteAPI hotel stay (NEW) ──
    // { rooms: [{ name, roomName, boardName, address, checkin, checkout,
    //             thumbnail, totalAmount, totalCurrency, offerId, hotelId }],
    //   confirmation: [{ prebookId, bookingId, hotelConfirmationCode }] }
    hotelStay: { type: Schema.Types.Mixed, default: undefined },

    // ── Sync Together ──
    // The group trip this booking belongs to (each member books their own
    // seat / room). Set only when the traveler is a member of that group.
    syncGroup: { type: Schema.Types.ObjectId, ref: "SyncGroup", default: null, index: true },
    // Set when this record is ONE PERSON'S share of a room shared with the
    // group. Only the organizer can cancel a shared room (from the trip page).
    // { splitPaymentId, groupId, shareId, people, roomTotal, shareAmount }
    sharedRoom: { type: Schema.Types.Mixed, default: undefined },

    // ── Confirmation email ── whether the traveler's confirmation went out.
    // { status: "sent"|"failed", to, at, error }
    confirmationEmail: { type: Schema.Types.Mixed, default: undefined },
    confirmationEmailAttempts: { type: Number, default: 0 },

    // ── Supplier references (NEW) ──
    // Which supplier fulfilled the booking and its own IDs, needed for
    // support, cancellations and reconciling against LiteAPI.
    provider: { type: String, default: null }, // e.g. "liteapi"
    providerBookingIds: { type: [String], default: [] },
    confirmationCodes: { type: [String], default: [] },

    dates: { type: datesSchema, default: () => ({}) },

    // Headcount — routes.js explicitly separates this Number from the
    // `passengers` array of actual people (see FIX comment in POST /).
    travelers: { type: Number, default: 1, min: 1 },

    passengers: { type: [passengerSchema], default: [] },

    addOns: { type: addOnsSchema, default: () => ({}) },

    status: {
      type: String,
      // cancel_pending: the airline accepted a cancellation but hasn't
      // finalized it yet (LiteAPI HTTP 202).
      enum: ["pending", "confirmed", "cancel_pending", "cancelled"],
      default: "pending",
      index: true,
    },

    // ── Cancellation record (NEW) ──
    // { at, by: "traveler"|"admin", byUserId, supplier: [...LiteAPI responses],
    //   supplierRefund, cancellationFee, customerRefund, currency, stripeRefundId }
    cancellation: { type: Schema.Types.Mixed, default: undefined },

    // ── Cancellation request ── used when automatic cancellation terms
    // aren't available. Nothing is cancelled by a request; Skyrio confirms
    // terms with the supplier and the traveler first.
    // { status: "open"|"resolved", at, byUserId, reason, resolvedAt, resolvedBy, resolution }
    cancelRequest: { type: Schema.Types.Mixed, default: undefined },

    // ── Admin notes (NEW) ── internal only, never shown to travelers
    adminNotes: {
      type: [
        new Schema(
          {
            text: { type: String, required: true },
            by: { type: String },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // Referenced in admin.routes.js dashboard aggregation
    // ($group by status, $sum total) and in growth-metrics cancellation
    // rate — required for revenue reporting to function.
    total: { type: Number, default: 0 },

    // Referenced in admin dashboard's recentBookings select().
    paidAt: { type: Date, default: null },

    // ── Stripe payment tracking ──
    // These were previously written by stripe.routes.js's webhook
    // handler via $set but did NOT exist on this schema — Mongoose's
    // default strict mode silently drops unknown fields on write, so
    // none of this was actually persisting. That broke refund lookups,
    // since charge.refunded / refund.failed search for a booking by
    // stripePaymentIntentId, which was never being saved.
    paymentIntentId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null, index: true },
    totalAmount: { type: Number, default: null },
    totalCurrency: { type: String, default: null },

    // ── Refund tracking ──
    refundStatus: {
      type: String,
      enum: ["none", "pending", "succeeded", "failed"],
      default: "none",
    },
    refundAmount: { type: Number, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Avoid OverwriteModelError in dev/hot-reload.
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
