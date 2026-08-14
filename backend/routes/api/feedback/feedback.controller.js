import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5, required: false },
    page: { type: String, required: false }, // e.g. "/book" or "Stays tab"
    userAgent: { type: String, required: false },
    status: {
      type: String,
      enum: ["new", "reviewed", "actioned", "dismissed"],
      default: "new",
    },
  },
  { timestamps: true }
);

// Avoid model overwrite errors on hot-reload
const Feedback =
  mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

// ─────────────────────────────────────────────────────────────
// POST /api/feedback
// Body: { message, rating?, page? }
// Auth optional — works for logged-in and anonymous users.
// ─────────────────────────────────────────────────────────────
export async function submitFeedback(req, res) {
  try {
    const { message, rating, page } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        ok: false,
        message: "'message' is required",
      });
    }

    const feedback = await Feedback.create({
      userId: req.user?._id || req.user?.id || undefined,
      message: message.trim(),
      rating: Number.isFinite(Number(rating)) ? Number(rating) : undefined,
      page: page || undefined,
      userAgent: req.headers["user-agent"] || undefined,
    });

    return res.json({ ok: true, feedback });
  } catch (err) {
    console.error("Feedback submission error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to submit feedback",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/feedback
// Admin-only listing — mirrors the "review what users said"
// use case. Add your own admin-auth middleware in the route
// file if you want to restrict this further.
//
// Query params: status?, page?, limit? (default 50)
// ─────────────────────────────────────────────────────────────
export async function listFeedback(req, res) {
  try {
    const { status, page: pageFilter, limit = "50" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (pageFilter) filter.page = pageFilter;

    const feedback = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .populate("userId", "email username")
      .lean();

    return res.json({ ok: true, count: feedback.length, feedback });
  } catch (err) {
    console.error("Feedback list error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to load feedback",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/feedback/:id/status
// Body: { status: "new" | "reviewed" | "actioned" | "dismissed" }
// ─────────────────────────────────────────────────────────────
export async function updateFeedbackStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["new", "reviewed", "actioned", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: `'status' must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ ok: false, message: "Feedback not found" });
    }

    return res.json({ ok: true, feedback });
  } catch (err) {
    console.error("Feedback status update error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to update feedback status",
    });
  }
}
