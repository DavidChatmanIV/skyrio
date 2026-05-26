/**
 * atlas.routes.js
 * ─────────────────────────────────────────────────────────────
 * All Atlas AI endpoints for Skyrio.
 * Mounted at /api/atlas via routes/api/index.js
 *
 * Routes:
 *   POST  /api/atlas/chat              — multi-turn booking assistant (with memory)
 *   POST  /api/atlas/query             — single-turn quick answer
 *   GET   /api/atlas/health            — provider health check
 *   GET   /api/atlas/preferences       — get all stored preferences
 *   DELETE /api/atlas/preferences/:id  — delete one preference
 *   DELETE /api/atlas/preferences      — clear all preferences
 *   POST  /api/atlas/trip-history      — add a completed trip
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  atlasConverse,
  atlasQuery,
  atlasHealthCheck,
  ATLAS_DEFAULT_SYSTEM_PROMPT,
} from "../../services/atlasService.js";
import {
  extractPreferences,
  getMemoryBrief,
  getUserPreferences,
  deletePreference,
  clearAllPreferences,
  addTripToHistory,
  incrementMessageCount,
} from "../../services/preferenceService.js";

const router = Router();

// ─── Dynamic system prompt builder (now with memory) ─────────

function buildContextualSystemPrompt(context = {}, memoryBrief = {}) {
  const {
    destination,
    budget,
    tripDays,
    bookingTotal,
    spent,
    flights = [],
  } = context;

  const lines = [ATLAS_DEFAULT_SYSTEM_PROMPT];

  // ── MEMORY SECTION ──
  // Injected BEFORE trip context so Atlas always has the user's
  // profile front-of-mind, even on a brand-new conversation.
  if (memoryBrief.summary) {
    lines.push("");
    lines.push("── WHAT YOU KNOW ABOUT THIS USER ──");
    lines.push(memoryBrief.summary);

    if (memoryBrief.totalConversations) {
      lines.push(
        `\nYou've chatted with this user ${
          memoryBrief.totalConversations
        } time${memoryBrief.totalConversations !== 1 ? "s" : ""} before.`
      );
    }
    if (memoryBrief.topDestinations?.length > 0) {
      lines.push(
        `Their most-searched destinations: ${memoryBrief.topDestinations.join(
          ", "
        )}`
      );
    }

    lines.push("");
    lines.push(
      "Use this knowledge naturally — don't announce that you remember things, " +
        "just apply the preferences. For example, if you know they prefer window " +
        "seats, mention window-seat availability without being asked. If they " +
        "previously said they're vegetarian, factor that into restaurant/food " +
        "suggestions automatically. If preferences conflict with what they're " +
        "asking now, follow their current request — people change their minds."
    );
  } else if (memoryBrief.isNewUser) {
    lines.push("");
    lines.push(
      "── NEW USER ── This is a new user. Be welcoming. As you chat, pay " +
        "attention to preferences they reveal (seat preference, dietary needs, " +
        "budget comfort zone, travel style) — the system will remember these " +
        "for future conversations."
    );
  }

  // ── TRIP CONTEXT SECTION (same as before) ──
  const hasAnyContext = destination || budget || flights.length > 0;
  if (hasAnyContext) {
    lines.push("");
    lines.push("── CURRENT TRIP CONTEXT ──");

    if (destination) lines.push(`Destination: ${destination}`);
    if (tripDays)
      lines.push(`Trip length: ${tripDays} day${tripDays !== 1 ? "s" : ""}`);
    if (budget)
      lines.push(`User's total budget: $${Number(budget).toLocaleString()}`);
    if (bookingTotal)
      lines.push(
        `Current booking cost: $${Number(bookingTotal).toLocaleString()}`
      );
    if (spent)
      lines.push(`Total spent so far: $${Number(spent).toLocaleString()}`);

    if (budget && bookingTotal) {
      const remaining =
        Number(budget) - Number(bookingTotal) - Number(spent || 0);
      lines.push(
        `Remaining budget: $${remaining.toLocaleString()} ${
          remaining < 0 ? "(OVER BUDGET)" : ""
        }`
      );
    }

    // Summarise flight results
    if (flights.length > 0) {
      lines.push("");
      lines.push(`── AVAILABLE FLIGHTS (${flights.length} results found) ──`);

      const top = flights.slice(0, 5);
      top.forEach((f, i) => {
        const price = f.totalAmount
          ? `$${parseFloat(f.totalAmount).toFixed(0)} ${f.totalCurrency || ""}`
          : "price unknown";
        const stops =
          f.stops === 0
            ? "Nonstop"
            : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
        const times = f.departingAt
          ? ` | Departs ${new Date(f.departingAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : "";
        lines.push(
          `${i + 1}. ${f.owner || "Airline"} — ${f.origin || "?"} → ${
            f.destination || destination || "?"
          } | ${stops} | ${price}${times}`
        );
      });

      if (flights.length > 5) {
        lines.push(`...and ${flights.length - 5} more options available.`);
      }
    }

    lines.push("");
    lines.push(
      "Use this context to give specific, accurate advice. " +
        "Reference actual flight prices and availability when answering. " +
        "If the user asks which flight to pick, recommend based on their budget and stops preference. " +
        "If they are over budget, proactively suggest ways to save."
    );
  }

  return lines.join("\n");
}

// ─── POST /api/atlas/chat ─────────────────────────────────────
// Full multi-turn conversation with memory + booking context.

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, context } = req.body;
    const userId = req.auth?.sub || req.user?.sub; // Auth0 user ID

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error:
          "messages must be a non-empty array of { role, content } objects.",
      });
    }

    const isValid = messages.every(
      (m) =>
        typeof m.role === "string" &&
        typeof m.content === "string" &&
        ["user", "assistant"].includes(m.role)
    );

    if (!isValid) {
      return res.status(400).json({
        error:
          'Each message must have role ("user" or "assistant") and content (string).',
      });
    }

    // ── 1. Fetch user memory (fast — single indexed query) ──
    const memoryBrief = userId
      ? await getMemoryBrief(userId)
      : { summary: "", preferenceCount: 0, isNewUser: true };

    // ── 2. Build context-aware + memory-aware system prompt ──
    const systemPrompt = buildContextualSystemPrompt(
      context || {},
      memoryBrief
    );

    // ── 3. Get Atlas response ──
    const reply = await atlasConverse(messages, systemPrompt);

    // ── 4. Fire-and-forget: extract preferences + update stats ──
    // These run in the background — they don't slow down the response.
    if (userId) {
      extractPreferences(userId, messages).catch((err) =>
        console.error("[atlas/chat] Preference extraction failed:", err.message)
      );
      incrementMessageCount(userId).catch(() => {});
    }

    return res.json({
      ok: true,
      reply,
      // Send memory metadata so frontend can show "Atlas remembers X things"
      memory: {
        preferenceCount: memoryBrief.preferenceCount,
        isNewUser: memoryBrief.isNewUser,
      },
    });
  } catch (err) {
    console.error("[atlas/chat] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/atlas/query ────────────────────────────────────
// Single-turn quick query (no memory — lightweight).

router.post("/query", requireAuth, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res
        .status(400)
        .json({ error: "message must be a non-empty string." });
    }

    const systemPrompt = buildContextualSystemPrompt(context || {}, {});
    const reply = await atlasQuery(message.trim(), systemPrompt);

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("[atlas/query] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/atlas/health ────────────────────────────────────

router.get("/health", async (_req, res) => {
  try {
    const result = await atlasHealthCheck();
    const statusCode = result.status === "ok" ? 200 : 503;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error("[atlas/health] Error:", err.message);
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PREFERENCE MANAGEMENT ENDPOINTS
// These power the "Atlas Memory" settings page where users can
// see what Atlas knows about them and control their data.
// ─────────────────────────────────────────────────────────────

// GET /api/atlas/preferences — view everything Atlas has learned
router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub;
    const data = await getUserPreferences(userId);
    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error("[atlas/preferences] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/atlas/preferences/:id — remove a single preference
router.delete("/preferences/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub;
    const deleted = await deletePreference(userId, req.params.id);
    return res.json({ ok: true, deleted });
  } catch (err) {
    console.error("[atlas/preferences] Delete error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/atlas/preferences — clear ALL preferences
router.delete("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub;
    const cleared = await clearAllPreferences(userId);
    return res.json({ ok: true, cleared });
  } catch (err) {
    console.error("[atlas/preferences] Clear error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/atlas/trip-history — log a completed trip
router.post("/trip-history", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub;
    const added = await addTripToHistory(userId, req.body);
    return res.json({ ok: true, added });
  } catch (err) {
    console.error("[atlas/trip-history] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
