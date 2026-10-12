import mongoose from "mongoose";

const { Schema } = mongoose;

const MemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    budget: { type: Number, default: null, min: 0 },
    availableFrom: { type: Date, default: null },
    availableTo: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
    departureAirport: { type: String, trim: true, default: null },
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },

    // ── NEW: family-unit grouping ──
    // Members sharing the same familyUnit string are voted/planned for
    // as a single block (used for multi-family trips). Leave null for
    // friend-group members who each vote independently.
    familyUnit: { type: String, trim: true, default: null },

    // ── Legacy split-payment field ── (the old "organizer pays, everyone
    // reimburses" flow). Sync Together now has each person book and pay for
    // their own part; shared rooms track holds on models/SplitPayment.js.
    // Mirrors the status of this member's share on the group's active
    // SplitPayment document (see models/SplitPayment.js). Kept here too,
    // denormalized, so the frontend can read it directly off the group
    // object (SyncGroupPage.jsx already reads member.paymentStatus)
    // without a second fetch. Source of truth for "is everyone paid" is
    // still the SplitPayment doc; this field is updated alongside it by
    // the Stripe webhook in stripe.routes.js.
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed"],
      default: "unpaid",
    },

    // Last time the organizer tapped "Remind" for this person (limits
    // reminders to one every 12 hours).
    lastRemindedAt: { type: Date, default: null },
  },
  { _id: true }
);

const ChangeRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Group shortlist ── flights and hotels someone suggested from search.
// The group votes; the organizer picks the winner.
const ShortlistItemSchema = new Schema(
  {
    kind: { type: String, enum: ["hotel", "flight", "activity"], required: true },
    key: { type: String, required: true }, // dedupe: hotelId, or airline+route+times
    suggestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    votes: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ["open", "picked"], default: "open" },
    // Hotel
    hotel: {
      hotelId: String,
      name: String,
      address: String,
      thumbnail: String,
      stars: Number,
      rating: Number,
      roomName: String,
      boardName: String,
      checkin: String,
      checkout: String,
      adults: Number,
    },
    // Flight
    flight: {
      airline: String,
      airlineCode: String,
      logo: String,
      origin: String,
      destination: String,
      departAt: String,
      arriveAt: String,
      returnDepartAt: String,
      returnArriveAt: String,
      stops: Number,
      cabin: String,
    },
    // Activity / excursion
    activity: {
      id: String,
      name: String,
      image: String,
      city: String,
      duration: String,
      rating: Number,
      reviews: Number,
      url: String,
    },
    price: { type: Number, default: null }, // as shown when suggested (per person for flights, per room for hotels)
    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

const ChatMessageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

// ── NEW: trip composition sub-schema ──
const TripCompositionSchema = new Schema(
  {
    // If null, category is auto-derived from member shape at read time
    // (see services/tripComposition.js). Set explicitly if the
    // "who's coming" UI step asks the user directly.
    category: {
      type: String,
      enum: [
        null,
        "immediateFamily",
        "multiFamily",
        "friends",
        "mixed",
        "romantic",
        "solo",
      ],
      default: null,
    },
    // Tie-breaker authority. Defaults to the group owner in the
    // pre-save hook below, but can be reassigned to any member.
    organizerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Whether Atlas should surface SyncTogether's voting/coordination
    // UI at all. False for immediate-family/solo/romantic trips where
    // there's a single decision-maker and the UI would just be noise.
    syncTogetherEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const SyncGroupSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, trim: true, default: "Untitled Trip" },
    members: [MemberSchema],
    status: {
      type: String,
      enum: [
        "draft",
        "inviting",
        "planning",
        "reviewing",
        "confirmed",
        // NEW: split-payment collection is in progress — the group has
        // a real Booking (see bookingId below) and every payer has a
        // Stripe PaymentIntent, but not everyone has paid yet.
        "payment_pending",
        "booked",
        "completed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    inviteCode: { type: String, unique: true, sparse: true },
    destination: { type: String, trim: true, default: null },
    departureAirport: { type: String, trim: true, default: null },
    cabinClass: {
      type: String,
      enum: ["economy", "premium_economy", "business", "first"],
      default: "economy",
    },
    departureTime: {
      type: String,
      enum: ["morning", "afternoon", "night", "any"],
      default: "any",
    },
    dateRangeStart: { type: Date, default: null },
    dateRangeEnd: { type: Date, default: null },

    // When the organizer wants everyone to land, in destination local time
    // ("YYYY-MM-DDTHH:mm"). Flights arriving outside it are flagged.
    // Set the first time every traveler has booked a flight and a room
    // (the "everyone's booked" email goes out once).
    allBookedAt: { type: Date, default: null },
    // Set once booking opens (everyone approved, or the organizer skipped
    // ahead). The booking tools stay visible after that, even if the plan
    // is regenerated later.
    bookingOpenedAt: { type: Date, default: null },

    // The hotel the organizer picked so everyone stays together. Members'
    // "Book my room" opens straight to this hotel's rooms.
    groupHotel: {
      hotelId: { type: String, default: null },
      name: { type: String, default: null },
      address: { type: String, default: null },
      thumbnail: { type: String, default: null },
      stars: { type: Number, default: null },
      rating: { type: Number, default: null },
      setAt: { type: Date, default: null },
    },

    arrivalWindow: {
      start: { type: String, default: null },
      end: { type: String, default: null },
      note: { type: String, trim: true, default: null },
    },

    // ── NEW: split-payment linkage ──
    // Set once the owner completes checkout in BookingCheckout.jsx
    // (POST /api/stripe/create-group-payment-intents). References the
    // real Booking created for this group's trip. The SplitPayment
    // document itself is looked up by this bookingId, not stored here
    // directly, so it stays the single source of truth.
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },

    // ── NEW ──
    tripComposition: { type: TripCompositionSchema, default: () => ({}) },

    // Atlas plan
    plan: { type: String, default: null },
    planGeneratedAt: { type: Date, default: null },
    planVersion: { type: Number, default: 0 },
    atlasMessages: { type: Array, default: [] },

    // Change requests
    changeRequests: [ChangeRequestSchema],

    // Group chat
    chatMessages: [ChatMessageSchema],

    // Group shortlist (suggest → vote → pick)
    shortlist: { type: [ShortlistItemSchema], default: [] },
    // The flight the organizer picked from the shortlist (people flying
    // from the same airport can book the same one).
    groupFlightKey: { type: String, default: null },

    // The organizer's own private budget (members keep theirs on members[].budget).
    // Nobody sees anyone else's number — the group sees only a comfort level.
    ownerBudget: { type: Number, default: null, min: 0 },

    // Activity log
    activityLog: [
      {
        type: { type: String, trim: true },
        user: { type: Schema.Types.ObjectId, ref: "User", default: null },
        message: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

SyncGroupSchema.pre("save", function (next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  // Default tie-breaker authority to the owner if never set
  if (!this.tripComposition) this.tripComposition = {};
  if (!this.tripComposition.organizerId) {
    this.tripComposition.organizerId = this.owner;
  }
  next();
});

SyncGroupSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    owner: this.owner,
    title: this.title,
    members: this.members,
    status: this.status,
    inviteCode: this.inviteCode,
    destination: this.destination,
    departureAirport: this.departureAirport,
    cabinClass: this.cabinClass,
    departureTime: this.departureTime,
    dateRangeStart: this.dateRangeStart,
    dateRangeEnd: this.dateRangeEnd,
    arrivalWindow: this.arrivalWindow,
    bookingId: this.bookingId,
    tripComposition: this.tripComposition,
    plan: this.plan,
    planGeneratedAt: this.planGeneratedAt,
    planVersion: this.planVersion,
    atlasMessages: this.atlasMessages,
    changeRequests: this.changeRequests,
    chatMessages: this.chatMessages,
    activityLog: this.activityLog,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const SyncGroup =
  mongoose.models.SyncGroup || mongoose.model("SyncGroup", SyncGroupSchema);

export default SyncGroup;
