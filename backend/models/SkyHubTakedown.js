import mongoose from "mongoose";

// A formal removal request — can come from someone WITHOUT a Skyrio account.
//   kind "intimate"  → TAKE IT DOWN Act (nonconsensual intimate images), 48-hour clock
//   kind "copyright" → DMCA §512(c) notice, with optional counter-notice from the poster
const counterSchema = new mongoose.Schema(
  {
    fullName: String,
    address: String,
    phone: String,
    email: String,
    statement: String, // why they believe it was removed by mistake
    consentsToJurisdiction: Boolean,
    signature: String,
    at: Date,
    // Restored after 10–14 business days unless the claimant says they've sued.
    restoreAfter: Date,
    restored: { type: Boolean, default: false },
  },
  { _id: false }
);

const skyHubTakedownSchema = new mongoose.Schema(
  {
    ticket: { type: String, required: true, unique: true }, // e.g. SKY-7Q4K2M
    kind: {
      type: String,
      enum: ["intimate", "copyright"],
      required: true,
      index: true,
    },
    source: { type: String, enum: ["form", "in_app"], default: "form" },

    // Who's asking
    requesterName: { type: String, trim: true, maxlength: 120 },
    requesterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: true,
    },
    requesterUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    relationship: {
      type: String,
      enum: ["self", "authorized", "owner", "agent"],
      default: "self",
    },

    // What to remove
    contentLinks: { type: String, maxlength: 2000, default: "" },
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "SkyHubPost" }],
    description: { type: String, maxlength: 2000, default: "" },
    copyrightedWork: { type: String, maxlength: 1000, default: "" }, // DMCA only

    // Legal statements the requester confirmed
    goodFaith: { type: Boolean, default: false },
    accuracyUnderPenalty: { type: Boolean, default: false }, // DMCA only
    signature: { type: String, trim: true, maxlength: 120 },

    status: {
      type: String,
      enum: ["received", "removed", "rejected", "restored"],
      default: "received",
      index: true,
    },
    dueBy: { type: Date, default: null, index: true },
    decisionNote: { type: String, maxlength: 1000, default: "" }, // shown to the requester
    duplicatesRemoved: { type: Number, default: 0 },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },

    counter: { type: counterSchema, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.SkyHubTakedown ||
  mongoose.model("SkyHubTakedown", skyHubTakedownSchema);
