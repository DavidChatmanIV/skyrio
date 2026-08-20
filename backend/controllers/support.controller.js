import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["billing", "technical", "account", "booking", "feature", "other"],
      default: "other",
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    page: { type: String, required: false },
    userAgent: { type: String, required: false },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    reply: { type: String, required: false, default: "" },
    notes: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model("SupportTicket", supportTicketSchema);

// ─────────────────────────────────────────────────────────────
// POST /api/support
// Body: { name, email, category, message, page? }
// Auth optional — works for logged-in and anonymous users.
// ─────────────────────────────────────────────────────────────
export async function submitSupportTicket(req, res) {
  try {
    const { name, email, category, message, page } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, message: "'name' is required" });
    }
    if (!email || !email.trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "'email' is required" });
    }
    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "'message' is required" });
    }

    const validCategories = [
      "billing",
      "technical",
      "account",
      "booking",
      "feature",
      "other",
    ];
    const safeCategory = validCategories.includes(category)
      ? category
      : "other";

    const ticket = await SupportTicket.create({
      userId: req.user?._id || req.user?.id || undefined,
      name: name.trim(),
      email: email.trim(),
      category: safeCategory,
      message: message.trim(),
      page: page || undefined,
      userAgent: req.headers["user-agent"] || undefined,
    });

    return res.json({ ok: true, ticket });
  } catch (err) {
    console.error("Support ticket submission error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to submit support ticket",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/support — admin listing
// Query params: status?, category?, limit? (default 50)
// ─────────────────────────────────────────────────────────────
export async function listSupportTickets(req, res) {
  try {
    const { status, category, limit = "50" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .populate("userId", "email username")
      .lean();

    return res.json({ ok: true, count: tickets.length, tickets });
  } catch (err) {
    console.error("Support ticket list error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to load support tickets",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/support/:id/status
// Body: { status: "open" | "in_progress" | "resolved" | "closed" }
// ─────────────────────────────────────────────────────────────
export async function updateSupportTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: `'status' must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!ticket) {
      return res
        .status(404)
        .json({ ok: false, message: "Support ticket not found" });
    }

    return res.json({ ok: true, ticket });
  } catch (err) {
    console.error("Support ticket status update error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to update support ticket status",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/support/:id/reply
// Body: { reply: string, notes?: string }
// ─────────────────────────────────────────────────────────────
export async function replyToSupportTicket(req, res) {
  try {
    const { id } = req.params;
    const { reply, notes } = req.body;

    const update = {};
    if (typeof reply === "string") update.reply = reply;
    if (typeof notes === "string") update.notes = notes;

    const ticket = await SupportTicket.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!ticket) {
      return res
        .status(404)
        .json({ ok: false, message: "Support ticket not found" });
    }

    return res.json({ ok: true, ticket });
  } catch (err) {
    console.error("Support ticket reply error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to reply to support ticket",
    });
  }
}
