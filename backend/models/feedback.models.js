import mongoose from "mongoose";

const { Schema, model, models } = mongoose;
const ref = (name, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  ...extra,
});

/* ─── Feedback ─────────────────────────────────────────────────────────────
   If you already have a Feedback model, replace it with this one, then run
   once so old rows show up in the admin inbox:
     db.feedbacks.updateMany(
       { status: { $exists: false } },
       { $set: { status: "new", type: "general" } }
     )
   ───────────────────────────────────────────────────────────────────────── */
const FeedbackSchema = new Schema(
  {
    user: ref("User", { index: true }), // empty when sent while signed out
    booking: ref("Booking"), // set for "checkout" ratings
    type: {
      type: String,
      enum: ["bug", "idea", "general", "checkout"],
      default: "general",
      index: true,
    },
    // Optional only for checkout ratings (stars alone are enough there).
    message: { type: String, default: "", maxlength: 4000 },
    rating: { type: Number, min: 1, max: 5 },
    page: String,
    status: {
      type: String,
      enum: ["new", "reviewing", "planned", "shipped", "closed"],
      default: "new",
      index: true,
    },
    adminNote: String,
    xpAwarded: { type: Number, default: 0 },
    shippedBonusAwarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// One checkout rating per booking.
FeedbackSchema.index(
  { user: 1, booking: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "checkout" },
  }
);

/* ─── Testimonial ─────────────────────────────────────────────────────── */
const TestimonialSchema = new Schema(
  {
    user: ref("User", { required: true }),
    booking: ref("Booking"), // empty = a general review, not tied to a trip
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    displayName: { type: String, maxlength: 40 },
    city: { type: String, maxlength: 60 },
    consent: { type: Boolean, default: false }, // OK to feature publicly
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectReason: {
      type: String,
      enum: ["spam", "profanity", "personal_info"],
    },
    featured: { type: Boolean, default: false, index: true },
    featuredAt: Date,
    reviewedBy: String,
    reviewedAt: Date,
    xpAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);
// One review per trip, and one general review per person.
TestimonialSchema.index({ user: 1, booking: 1 }, { unique: true });

/* ─── XP awards (one row per award, so any of them can be reversed) ───── */
const XpAwardSchema = new Schema(
  {
    user: ref("User", { required: true }),
    amount: { type: Number, required: true },
    reason: {
      type: String,
      enum: [
        "FEEDBACK_QUICK",
        "FEEDBACK_DETAILED",
        "TESTIMONIAL",
        "FEEDBACK_SHIPPED",
      ],
      required: true,
    },
    source: {
      kind: { type: String, enum: ["feedback", "testimonial"] },
      id: Schema.Types.ObjectId,
    },
    reversed: { type: Boolean, default: false },
    reversedAt: Date,
    reversedBy: String,
  },
  { timestamps: true }
);
XpAwardSchema.index({ user: 1, reason: 1, createdAt: -1 });
XpAwardSchema.index({ "source.kind": 1, "source.id": 1 });

/* ─── Review prompts (who was asked, who said "not now", who answered) ── */
const ReviewPromptSchema = new Schema(
  {
    user: ref("User", { required: true }),
    booking: ref("Booking", { required: true }),
    shownAt: Date,
    dismissedAt: Date,
    respondedAt: Date,
  },
  { timestamps: true }
);
ReviewPromptSchema.index({ user: 1, booking: 1 }, { unique: true });

/* ─── Admin audit log ─────────────────────────────────────────────────── */
const AdminAuditSchema = new Schema(
  {
    admin: String,
    action: { type: String, required: true },
    target: {
      kind: String,
      id: Schema.Types.ObjectId,
    },
    detail: String,
  },
  { timestamps: true }
);

export const Feedback = models.Feedback || model("Feedback", FeedbackSchema);
export const Testimonial =
  models.Testimonial || model("Testimonial", TestimonialSchema);
export const XpAward = models.XpAward || model("XpAward", XpAwardSchema);
export const ReviewPrompt =
  models.ReviewPrompt || model("ReviewPrompt", ReviewPromptSchema);
export const AdminAudit =
  models.AdminAudit || model("AdminAudit", AdminAuditSchema);
