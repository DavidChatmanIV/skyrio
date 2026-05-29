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
  },
  { _id: true }
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
        "booked",
        "completed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    inviteCode: { type: String, unique: true, sparse: true },
    destination: { type: String, trim: true, default: null },
    dateRangeStart: { type: Date, default: null },
    dateRangeEnd: { type: Date, default: null },
  },
  { timestamps: true }
);

// Generate a short invite code before saving
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
    dateRangeStart: this.dateRangeStart,
    dateRangeEnd: this.dateRangeEnd,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const SyncGroup =
  mongoose.models.SyncGroup || mongoose.model("SyncGroup", SyncGroupSchema);

export default SyncGroup;
