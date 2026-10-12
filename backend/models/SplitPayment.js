import mongoose from "mongoose";

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────
// SplitPayment
//
// kind "shared_room" (current): one hotel room shared by several Sync
// Together members. Each person puts a HOLD on their own card for their
// share (Stripe authorize-only). Nobody is charged until everyone's hold
// is in. Then Skyrio books the room once and charges each hold.
// If the deadline passes first, every hold is released — nobody pays.
//
// kind "reimbursement" (legacy): the old "organizer pays everything,
// everyone else pays them back" split. Kept only so old records load.
// ─────────────────────────────────────────────────────────────

const ShareSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, default: null }, // SyncGroup members[]._id (null = organizer)
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    amountOwed: { type: Number, required: true, min: 0 }, // cents
    currency: { type: String, default: "usd" },
    // unpaid → authorized (card held) → paid (charged)
    // released: hold let go, nothing charged. refunded: charged, then refunded.
    status: {
      type: String,
      enum: ["unpaid", "authorized", "paid", "failed", "released", "refunded"],
      default: "unpaid",
    },
    stripePaymentIntentId: { type: String, default: null },
    authorizedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    capturedCents: { type: Number, default: 0 },
    refundedCents: { type: Number, default: 0 },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null }, // this person's My Trips record
    lastError: { type: String, default: null },
    // Automatic deadline reminders already sent to this person ("24h", "6h").
    remindersSent: { type: [String], default: [] },
  },
  { _id: true }
);

const SplitPaymentSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["shared_room", "reimbursement"],
      default: "reimbursement", // old records have no kind
      index: true,
    },
    // Legacy reimbursement splits pointed at one Booking. Shared rooms get
    // one Booking per person (on each share) once the room is booked.
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    group: { type: Schema.Types.ObjectId, ref: "SyncGroup", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // collecting → booking → booked
    //            ↘ expired / released (holds let go, nobody charged)
    //            ↘ failed (hotel couldn't book; holds let go)
    // booked → cancelled
    status: {
      type: String,
      enum: ["collecting", "booking", "booked", "expired", "released", "failed", "cancelled"],
      default: "collecting",
      index: true,
    },
    deadline: { type: Date, default: null, index: true },

    // What's being booked — copied from the hotel search result.
    room: {
      hotelId: String,
      offerId: String,
      name: String, // hotel name
      roomName: String,
      boardName: String,
      address: String,
      thumbnail: String,
      checkin: String, // YYYY-MM-DD
      checkout: String,
      adults: Number,
    },
    // The name the hotel books the room under (the organizer types it at
    // checkout, the same as a normal hotel booking).
    holder: {
      firstName: String,
      lastName: String,
      email: String,
    },
    totalCents: { type: Number, default: 0 },
    currency: { type: String, default: "usd" },

    // Filled in once LiteAPI confirms
    supplier: {
      prebookId: String,
      bookingId: String,
      hotelConfirmationCode: String,
      bookedCents: Number, // what the hotel actually charged (≤ totalCents)
      bookedAt: Date,
    },
    cancellation: { type: Schema.Types.Mixed, default: undefined },
    closedReason: { type: String, default: null },

    shares: [ShareSchema],
  },
  { timestamps: true }
);

SplitPaymentSchema.methods.allPaid = function () {
  return this.shares.length > 0 && this.shares.every((s) => s.status === "paid");
};

SplitPaymentSchema.methods.allAuthorized = function () {
  return (
    this.shares.length > 0 &&
    this.shares.every((s) => s.status === "authorized" || s.status === "paid")
  );
};

const SplitPayment =
  mongoose.models.SplitPayment || mongoose.model("SplitPayment", SplitPaymentSchema);

export default SplitPayment;
