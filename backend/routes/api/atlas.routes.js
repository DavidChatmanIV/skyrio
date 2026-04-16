/**
 * ─────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/atlas/chat       — multi-turn booking assistant
 *   POST /api/atlas/query      — single-turn quick answer
 *   GET  /api/atlas/health     — provider health check
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  atlasConverse,
  atlasQuery,
  atlasHealthCheck,
} from "../../services/atlasService.js";

const router = Router();

// ─── POST /api/atlas/chat ─────────────────────────────────────
// Full multi-turn conversation.
// Use this for the booking assistant, itinerary builder,
// and any flow that needs conversation history.
//
// Body: { messages: [{ role: "user" | "assistant", content: string }] }
// Auth: required

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error:
          "messages must be a non-empty array of { role, content } objects.",
      });
    }

    // Validate each message has role + content
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

    const reply = await atlasConverse(messages);

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("[atlas/chat] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/atlas/query ────────────────────────────────────
// Single-turn quick query — cheaper + faster model.
// Use this for FAQ lookups, support triage, one-off questions.
//
// Body: { message: string }
// Auth: required

router.post("/query", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res
        .status(400)
        .json({ error: "message must be a non-empty string." });
    }

    const reply = await atlasQuery(message.trim());

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("[atlas/query] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/atlas/health ────────────────────────────────────
// Provider health check — use from your monitoring dashboard.
// Returns active provider, status, and response latency.
// Auth: NOT required (so uptime monitors can ping it freely)

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

export default router;