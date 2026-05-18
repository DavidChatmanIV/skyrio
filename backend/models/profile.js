import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    username: {
      type: String,
      trim: true,
      default: "",
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    homeAirport: {
      type: String,
      trim: true,
      default: "",
    },
    vibe: {
      type: String,
      trim: true,
      default: "",
    },
    badges: {
      type: [String],
      default: [],
    },

    // ✅ n2/c2: Profile music — syncs across devices
    // Saved by ProfileMusicModal via POST /api/profile/music
    profileMusic: {
      url: { type: String, default: "" },
      name: { type: String, default: "" },
      provider: { type: String, default: "youtube" },
      updatedAt: { type: Date },
    },

    // ✅ n7: Travel vibes — set during onboarding
    // Used by Atlas to personalise suggestions
    travelVibes: {
      type: [String],
      default: [],
    },

    // ✅ s2: Home airport object — set during onboarding
    homeAirportData: {
      code: { type: String },
      city: { type: String },
      name: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Profile", profileSchema);
