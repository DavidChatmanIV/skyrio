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
