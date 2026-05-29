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
    // Review flow
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
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
    dateRangeStart: { type: Date, default: null },
    dateRangeEnd: { type: Date, default: null },

    // Atlas plan
    plan: { type: String, default: null },
    planGeneratedAt: { type: Date, default: null },
    planVersion: { type: Number, default: 0 },
    atlasMessages: { type: Array, default: [] },

    // Change requests from members
    changeRequests: [ChangeRequestSchema],
  },
  { timestamps: true }
);

SyncGroupSchema.pre("save", function (next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    dateRangeStart: this.dateRangeStart,
    dateRangeEnd: this.dateRangeEnd,
    plan: this.plan,
    planGeneratedAt: this.planGeneratedAt,
    planVersion: this.planVersion,
    atlasMessages: this.atlasMessages,
    changeRequests: this.changeRequests,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const SyncGroup =
  mongoose.models.SyncGroup || mongoose.model("SyncGroup", SyncGroupSchema);

export default SyncGroup;
