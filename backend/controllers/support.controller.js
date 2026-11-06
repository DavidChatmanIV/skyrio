import mongoose from "mongoose";
import { notifyAdmins } from "../utils/notifyAdmins.js";

// ─────────────────────────────────────────────────────────────
// Support tickets ("Need help?" panel + Atlas hand-offs)
//
// Replies now actually reach the customer: PATCH /:id/reply emails them
// (Resend) and keeps a history in `replies`, so the dashboard shows the
// whole conversation. `reply` still holds the latest reply, so older
// screens that read it keep working.
// ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  "billing",
  "technical",
  "account",
  "booking",
  "feature",
  "other",
];
const STATUSES = ["open", "in_progress", "resolved", "closed"];

const replySchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    by: { type: String, default: "" }, // admin email
    emailed: { type: Boolean, default: false },
    emailError: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: CATEGORIES, default: "other" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    page: { type: String, required: false },
    userAgent: { type: String, required: false },
    status: { type: String, enum: STATUSES, default: "open" },
    // Where it came from: the help form, or Atlas handing off a chat.
    source: { type: String, enum: ["form", "atlas"], default: "form" },
    // Someone needs help fast (e.g. stuck at the airport). Texts admins.
    urgent: { type: Boolean, default: false },
    // Optional: the booking this is about, so the dashboard can link to it.
    bookingId: { type: String, required: false },
    replies: { type: [replySchema], default: [] },
    lastReplyAt: { type: Date },
    reply: { type: String, required: false, default: "" }, // latest reply
    notes: { type: String, required: false, default: "" }, // internal only
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, createdAt: -1 });

const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;

/* ── helpers ───────────────────────────────────────────────── */

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const firstName = (name = "") => String(name).trim().split(/\s+/)[0] || "";

/**
 * Emails the customer your reply through Resend.
 * Env: RESEND_API_KEY, and SUPPORT_FROM_EMAIL (or RESEND_FROM / EMAIL_FROM),
 * e.g. "Skyrio Support <support@myskyrio.com>" on your verified domain.
 * Replies go to skyrioofficial@gmail.com unless SUPPORT_REPLY_TO is set.
 */
async function emailReply(ticket, body) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.SUPPORT_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM;
  if (!key || !from) {
    throw new Error("Email isn't set up (RESEND_API_KEY / from address).");
  }
  const hi = firstName(ticket.name);
  const text = `Hi${
    hi ? ` ${hi}` : ""
  },\n\n${body}\n\n— The Skyrio team\n\n---\nYou wrote:\n${ticket.message}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e;max-width:560px">
      <p>Hi${hi ? ` ${escapeHtml(hi)}` : ""},</p>
      <p style="white-space:pre-wrap">${escapeHtml(body)}</p>
      <p>— The Skyrio team</p>
      <hr style="border:none;border-top:1px solid #e5e5ef;margin:24px 0" />
      <p style="font-size:13px;color:#6b6b80;margin:0 0 4px">You wrote:</p>
      <p style="font-size:13px;color:#6b6b80;white-space:pre-wrap;margin:0">${escapeHtml(
        ticket.message
      )}</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [ticket.email],
      reply_to: process.env.SUPPORT_REPLY_TO || "skyrioofficial@gmail.com",
      subject: "Re: your Skyrio support request",
      text,
      html,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `Email failed (${res.status})`);
  }
}

/* ── POST /api/support ─────────────────────────────────────────
   Body: { name, email, category, message, page?, urgent?, source?, bookingId? }
   Auth optional — works for logged-in and anonymous users. */
export async function submitSupportTicket(req, res) {
  try {
    const { name, email, category, message, page, urgent, source, bookingId } =
      req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, message: "'name' is required" });
    }
    if (!email || !String(email).trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "'email' is required" });
    }
    if (!message || !String(message).trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "'message' is required" });
    }

    const ticket = await SupportTicket.create({
      userId: req.user?._id || req.user?.id || undefined,
      name: String(name).trim(),
      email: String(email).trim(),
      category: CATEGORIES.includes(category) ? category : "other",
      message: String(message).trim(),
      page: page || undefined,
      userAgent: req.headers["user-agent"] || undefined,
      urgent: urgent === true,
      source: source === "atlas" ? "atlas" : "form",
      bookingId: bookingId ? String(bookingId).slice(0, 100) : undefined,
    });

    // Text admin phones (never blocks or fails the request).
    const preview = ticket.message.replace(/\s+/g, " ").slice(0, 90);
    notifyAdmins(
      ticket.urgent ? "supportUrgent" : "supportAll",
      `${ticket.urgent ? "URGENT " : ""}ticket from ${ticket.name} (${
        ticket.category
      }): ${preview}`
    );

    return res.json({ ok: true, ticket });
  } catch (err) {
    console.error("Support ticket submission error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to submit support ticket" });
  }
}

/* ── GET /api/support — admin listing ─────────────────────────
   Query: status?, category?, q? (name/email/message), limit? (≤200)
   Returns: { tickets, count, counts: { open, in_progress, resolved, closed } } */
export async function listSupportTickets(req, res) {
  try {
    const { status, category, q, limit = "50" } = req.query;

    const filter = {};
    if (status && STATUSES.includes(status)) filter.status = status;
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (q && String(q).trim()) {
      const re = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
      filter.$or = [{ name: re }, { email: re }, { message: re }];
    }

    const [tickets, byStatus] = await Promise.all([
      SupportTicket.find(filter)
        // Urgent first, then newest.
        .sort({ urgent: -1, createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 200))
        .populate("userId", "email username name")
        .lean(),
      SupportTicket.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.forEach((r) => {
      if (r._id in counts) counts[r._id] = r.n;
    });

    return res.json({ ok: true, count: tickets.length, counts, tickets });
  } catch (err) {
    console.error("Support ticket list error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load support tickets" });
  }
}

/* ── PATCH /api/support/:id/status ────────────────────────────
   Body: { status: "open" | "in_progress" | "resolved" | "closed" } */
export async function updateSupportTicketStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: `'status' must be one of: ${STATUSES.join(", ")}`,
      });
    }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
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
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update support ticket status" });
  }
}

/* ── PATCH /api/support/:id/reply ─────────────────────────────
   Body: { reply?: string, notes?: string, status?: string, send?: boolean }
   - reply + send (default true): emails the customer and adds it to the
     conversation. An open ticket moves to "in_progress" unless `status`
     says otherwise (e.g. "resolved" for "Send & resolve").
   - notes: internal note, never sent to the customer.
   If the email fails, the reply is still saved with emailed:false so you
   can see it and try again. */
export async function replyToSupportTicket(req, res) {
  try {
    const { reply, notes, status, send = true } = req.body || {};
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res
        .status(404)
        .json({ ok: false, message: "Support ticket not found" });
    }

    if (typeof notes === "string") ticket.notes = notes.slice(0, 4000);

    let emailError = "";
    const body = typeof reply === "string" ? reply.trim() : "";
    if (body) {
      let emailed = false;
      if (send) {
        try {
          await emailReply(ticket, body);
          emailed = true;
        } catch (e) {
          emailError = e.message;
          console.error("[support] reply email failed:", e.message);
        }
      }
      ticket.replies.push({
        body: body.slice(0, 4000),
        by: req.admin?.email || "",
        emailed,
        emailError,
      });
      ticket.reply = body.slice(0, 4000);
      ticket.lastReplyAt = new Date();
      if (!status && ticket.status === "open") ticket.status = "in_progress";
    }

    if (status && STATUSES.includes(status)) ticket.status = status;

    await ticket.save();
    return res.json({
      ok: true,
      ticket,
      emailed: body ? !emailError : undefined,
      emailError: emailError || undefined,
    });
  } catch (err) {
    console.error("Support ticket reply error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to reply to support ticket" });
  }
}
