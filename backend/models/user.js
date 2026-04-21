import mongoose from "mongoose";

const { Schema } = mongoose;

/* -----------------------------
   Preferences (social + official)
------------------------------ */
const PreferencesSchema = new Schema(
  {
    officialUpdatesMuted: { type: Boolean, default: false },
  },
  { _id: false }
);

/* -----------------------------
   User
------------------------------ */
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

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // ---------- Profile ----------
    avatar: { type: String, default: "/default-avatar.png" },
    bio: { type: String, trim: true },

    // ---------- Social Core ----------
    isOfficial: { type: Boolean, default: false },

    // ✅ Relationship lists (ObjectId-based, scalable)
    followers: [
      { type: Schema.Types.ObjectId, ref: "User", index: true, default: [] },
    ],
    following: [
      { type: Schema.Types.ObjectId, ref: "User", index: true, default: [] },
    ],

    // Fast counters for UI (kept in sync by follow/unfollow logic)
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },

    preferences: { type: PreferencesSchema, default: () => ({}) },

    // ---------- XP & Rewards ----------
    xp: { type: Number, default: 0, min: 0 },

    settings: {
      rewardsEnabled: { type: Boolean, default: false },
    },

    // ---------- RBAC ROLE SYSTEM ----------
    role: {
      type: String,
      enum: ["user", "support", "manager", "admin"],
      default: "user",
      index: true,
    },

    isActive: { type: Boolean, default: true },

    // ---------- Moderation / Trust & Safety ----------
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

    // ---------- Saved Trips ----------
    savedTrips: [{ type: Schema.Types.ObjectId, ref: "Place" }],

    // ---------- Password Reset ----------
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date, select: false },
  },
  { timestamps: true }
);

/* -----------------------------
   Moderation helpers
------------------------------ */
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

/* -----------------------------
   Instance helpers
------------------------------ */
UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    bio: this.bio,

    xp: this.xp,
    settings: this.settings,

    role: this.role,
    isOfficial: this.isOfficial,
    isActive: this.isActive,

    followersCount: this.followersCount,
    followingCount: this.followingCount,
    preferences: this.preferences,

    moderation: this.moderation,

    savedTrips: this.savedTrips,

    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/* -----------------------------
   Transform JSON output
------------------------------ */
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

/* -----------------------------
   Export
------------------------------ */
const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;