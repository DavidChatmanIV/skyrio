import mongoose from "mongoose";

const skyHubPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    authorName: { type: String, default: "Traveler", trim: true },
    username: { type: String, default: "traveler", trim: true },
    avatar: { type: String, default: "TR" },
    verified: { type: Boolean, default: false },
    type: {
      type: String,
      // "Tip" / "Photo" are what the composer sends; the long names are older values.
      enum: [
        "Tip",
        "Travel Tip",
        "Question",
        "Story",
        "Photo",
        "Photo Drop",
        "Join Trip",
      ],
      default: "Story",
    },
    destination: { type: String, default: "", trim: true, maxlength: 120 },

    // Map point for the destination, filled in from OpenWeather geocoding
    // when the post is created or edited. Used by the Nearby tab.
    // GeoJSON order is [longitude, latitude].
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    // Text is optional when the post has at least one photo (photo-only posts).
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
      validate: {
        validator: function (v) {
          const hasPhotos =
            (this.images && this.images.length > 0) || Boolean(this.image);
          return Boolean((v || "").trim()) || hasPhotos;
        },
        message: "A post needs text or a photo.",
      },
    },
    image: { type: String, default: "" },
    // Up to 4 photos, all uploaded through /api/uploads/image?purpose=post
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    budget: { type: String, default: "" },
    helpful: { type: Boolean, default: false },
    likes: { type: [String], default: [] },
    saves: { type: [String], default: [] },

    // Set when the author edits the post after sharing it.
    editedAt: { type: Date, default: null },

    // ── Moderation ──
    // Legacy per-post reports (new reports live in SkyHubReport).
    reports: {
      type: [
        {
          userId: String,
          reason: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    reportCount: { type: Number, default: 0 },
    // hidden: kept out of the feed. "review" = auto-hidden after several
    // reports until an admin looks; "removed" = taken down by an admin.
    hidden: { type: Boolean, default: false, index: true },
    hiddenReason: {
      type: String,
      enum: [null, "review", "removed"],
      default: null,
    },
    hiddenAt: { type: Date, default: null },
    // Evidence hold (child-safety reports go to NCMEC and must be kept for
    // a year). While set, the author's "delete" only hides the post.
    legalHoldUntil: { type: Date, default: null },

    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

skyHubPostSchema.index({ hidden: 1, createdAt: -1 });
// Nearby tab: geo search on the destination's map point.
// Posts without a location are skipped by this index.
skyHubPostSchema.index({ location: "2dsphere" });

export default mongoose.models.SkyHubPost ||
  mongoose.model("SkyHubPost", skyHubPostSchema);
