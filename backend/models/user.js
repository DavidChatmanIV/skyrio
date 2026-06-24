import mongoose from "mongoose";
import { getLevel } from "../config/xpRules.js";

const { Schema } = mongoose;

const PreferencesSchema = new Schema(
  { officialUpdatesMuted: { type: Boolean, default: false } },
  { _id: false }
);

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
//
// This used to compute its own separate 6-tier ladder (Newcomer/Explorer@200
// XP/Adventurer@500/...) that disagreed with the real 8-tier system in
// config/xpRules.js (Explorer@0/Adventurer@100/Voyager@300/...) — the one
// actually shown on the live Passport page. A 70 XP user would have shown
// as "Newcomer" here but "Explorer" everywhere else. Now this just
// translates getLevel()'s output into the same field names this method
// has always returned, so toSafeJSON() and anything reading
// levelLabel/levelProgressPct/nextLevel/xpToNext keeps working exactly as
// before — it just gets correct, consistent values now.
//
// New code should prefer calling getLevel(user.xp) from
// ../config/xpRules.js directly; this method exists for backward
// compatibility with whatever already reads these specific field names.
UserSchema.methods.getXPLevel = function () {
  const { current, next, percent, xpToNext } = getLevel(this.xp || 0);
  return {
    levelLabel: current.name,
    levelProgressPct: percent,
    nextLevel: next?.name || null,
    xpToNext,
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
