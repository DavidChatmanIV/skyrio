import mongoose from "mongoose";

const { Schema } = mongoose;

const PreferencesSchema = new Schema(
  { officialUpdatesMuted: { type: Boolean, default: false } },
  { _id: false }
);

// ── XP Level thresholds ───────────────────────────────────────
const XP_LEVELS = [
  { label: "Newcomer", min: 0 },
  { label: "Explorer", min: 200 },
  { label: "Adventurer", min: 500 },
  { label: "Globetrotter", min: 1000 },
  { label: "Voyager", min: 2000 },
  { label: "Legend", min: 5000 },
];

const UserSchema = new Schema(
  {
    // ---------- Core Identity ----------
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },

    // ---------- Profile ----------
    avatar: { type: String, default: "/default-avatar.png" },
    bio: { type: String, trim: true },
    city: { type: String, trim: true },
    travelVibes: { type: [String], default: [] },

    // ---------- Verification ----------
    verifiedTier: {
      type: String,
      enum: [null, "orange", "blue", "purple"],
      default: null,
    },
    verificationPending: { type: Boolean, default: false },

    // ---------- Social Core ----------
    isOfficial: { type: Boolean, default: false },
    followers: [
      { type: Schema.Types.ObjectId, ref: "User", index: true, default: [] },
    ],
    following: [
      { type: Schema.Types.ObjectId, ref: "User", index: true, default: [] },
    ],
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    preferences: { type: PreferencesSchema, default: () => ({}) },

    // ---------- XP & Rewards ----------
    xp: { type: Number, default: 0, min: 0 },
    // Tracks which one-time Passport Rewards items this user has redeemed.
    // Enforced atomically alongside the xp deduction in
    // routes/api/rewards.routes.js so a non-repeatable item can't be
    // redeemed twice (including across two open tabs racing each other),
    // and so the frontend can correctly show "Redeemed" after a refresh
    // instead of resetting to redeemable.
    redeemedRewards: { type: [String], default: [] },
    settings: { rewardsEnabled: { type: Boolean, default: false } },

    // ---------- XP Earning System (routes/xp.js) ----------
    // membershipPlan was removed from here — xp.js now reads the existing
    // `plan` field below (---------- Membership Plan ----------) instead
    // of a separate field, so there's one source of truth for tier instead
    // of two that could drift apart again.
    xpTotalEarned: { type: Number, default: 0 },
    xpDailyTotal: { type: Number, default: 0 },
    xpDailyMeta: { type: Schema.Types.Mixed, default: {} },
    xpRecentEvents: { type: Array, default: [] },

    // ---------- Referrals ----------
    referredBy: { type: String, default: null },
    referralsCount: { type: Number, default: 0, min: 0 },
    lastShareXpDate: { type: String, default: null },

    // ---------- RBAC Role System ----------
    role: {
      type: String,
      enum: ["user", "support", "manager", "admin"],
      default: "user",
      index: true,
    },
    isActive: { type: Boolean, default: true },

    // ---------- Moderation ----------
    moderation: {
      status: {
        type: String,
        enum: ["ok", "warned", "restricted", "suspended"],
        default: "ok",
        index: true,
      },
      warningsCount: { type: Number, default: 0, min: 0 },
      strikesCount: { type: Number, default: 0, min: 0 },
      mutedUntil: { type: Date, default: null },
      suspendedUntil: { type: Date, default: null },
      lastReviewedAt: { type: Date, default: null },
      lastReviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      notesCount: { type: Number, default: 0, min: 0 },
    },

    // ---------- Membership Plan ----------
    plan: {
      type: String,
      enum: ["free", "explorer", "legend"],
      default: "free",
      index: true,
    },

    // ---------- Saved Trips ----------
    savedTrips: [{ type: Schema.Types.ObjectId, ref: "Place" }],

    // ---------- Email Verification ----------
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpiry: { type: Date, select: false },

    // ---------- Password Reset ----------
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date, select: false },
  },
  { timestamps: true }
);

// ── Moderation helpers ────────────────────────────────────────
UserSchema.methods.isMuted = function () {
  const until = this?.moderation?.mutedUntil;
  return until ? new Date(until).getTime() > Date.now() : false;
};
UserSchema.methods.isSuspended = function () {
  const until = this?.moderation?.suspendedUntil;
  return until ? new Date(until).getTime() > Date.now() : false;
};
UserSchema.methods.isRestricted = function () {
  return this?.moderation?.status === "restricted";
};
UserSchema.methods.canPost = function () {
  if (!this.isActive) return false;
  if (this.isSuspended()) return false;
  if (this.isMuted()) return false;
  if (this.isRestricted()) return false;
  return true;
};
UserSchema.methods.getModerationStatus = function () {
  if (this.isSuspended()) return "suspended";
  if (this.isMuted()) return "restricted";
  return this?.moderation?.status || "ok";
};

// ── XP Level helper ───────────────────────────────────────────
// Returns levelLabel, levelProgressPct, nextLevel, xpToNext
// based on the user's current XP. Used in toSafeJSON so every
// API response includes up-to-date level info automatically.
UserSchema.methods.getXPLevel = function () {
  const xp = this.xp || 0;
  let current = XP_LEVELS[0];
  let next = XP_LEVELS[1] || null;

  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].min) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] || null;
    }
  }

  const progressPct = next
    ? Math.round(((xp - current.min) / (next.min - current.min)) * 100)
    : 100;

  return {
    levelLabel: current.label,
    levelProgressPct: Math.min(progressPct, 100),
    nextLevel: next?.label || null,
    xpToNext: next ? next.min - xp : 0,
  };
};

// ── toSafeJSON ────────────────────────────────────────────────
// Used everywhere we return a user object to the frontend.
// Includes computed XP level fields so Dashboard, Passport,
// and SkyHub all get levelLabel + levelProgressPct automatically.
UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    bio: this.bio,
    city: this.city,
    travelVibes: this.travelVibes,
    verifiedTier: this.verifiedTier,
    verificationPending: this.verificationPending,
    referredBy: this.referredBy,
    referralsCount: this.referralsCount,
    xp: this.xp,
    ...this.getXPLevel(),
    settings: this.settings,
    role: this.role,
    plan: this.plan,
    isOfficial: this.isOfficial,
    isActive: this.isActive,
    emailVerified: this.emailVerified,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    preferences: this.preferences,
    moderation: this.moderation,
    savedTrips: this.savedTrips,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

UserSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.followers;
    delete ret.following;
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
