import mongoose from "mongoose";

// A traveler suspended from posting/commenting on SkyHub by an admin.
// until: null = until lifted by hand.
const skyHubRestrictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    until: { type: Date, default: null },
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    by: { type: String, default: null },
    // Set when this pause came from a strike (an approved appeal lifts it).
    strike: { type: mongoose.Schema.Types.ObjectId, ref: "SkyHubStrike", default: null },
    permanent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.SkyHubRestriction || mongoose.model("SkyHubRestriction", skyHubRestrictionSchema);
