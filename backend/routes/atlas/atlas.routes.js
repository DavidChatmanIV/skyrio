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
  ATLAS_DEFAULT_SYSTEM_PROMPT,
} from "../../services/atlasService.js";

const router = Router();

// ─── Dynamic system prompt builder ───────────────────────────
// Builds a rich, context-aware system prompt from whatever
// booking data the frontend sends. Falls back to the default
// prompt when no context is provided.

function buildContextualSystemPrompt(context = {}) {
  const {
    destination,
    budget,
    tripDays,
    bookingTotal,
    spent,
    flights = [],
  } = context;

  // No context at all — use default
  const hasAnyContext = destination || budget || flights.length > 0;
  if (!hasAnyContext) return ATLAS_DEFAULT_SYSTEM_PROMPT;

  const lines = [ATLAS_DEFAULT_SYSTEM_PROMPT, "", "── CURRENT TRIP CONTEXT ──"];

  if (destination) {
    lines.push(`Destination: ${destination}`);
  }

  if (tripDays) {
    lines.push(`Trip length: ${tripDays} day${tripDays !== 1 ? "s" : ""}`);
  }

  if (budget) {
    lines.push(`User's total budget: $${Number(budget).toLocaleString()}`);
  }

  if (bookingTotal) {
    lines.push(
      `Current booking cost: $${Number(bookingTotal).toLocaleString()}`
    );
  }

  if (spent) {
    lines.push(`Total spent so far: $${Number(spent).toLocaleString()}`);
  }

  if (budget && bookingTotal) {
    const remaining =
      Number(budget) - Number(bookingTotal) - Number(spent || 0);
    lines.push(
      `Remaining budget: $${remaining.toLocaleString()} ${
        remaining < 0 ? "(OVER BUDGET)" : ""
      }`
    );
  }

  // Summarise flight results so Atlas can reference real options
  if (flights.length > 0) {
    lines.push("");
    lines.push(`── AVAILABLE FLIGHTS (${flights.length} results found) ──`);

    const top = flights.slice(0, 5); // send top 5 to keep prompt lean
    top.forEach((f, i) => {
      const price = f.totalAmount
        ? `$${parseFloat(f.totalAmount).toFixed(0)} ${f.totalCurrency || ""}`
        : "price unknown";
      const stops =
        f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
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

  return lines.join("\n");
}

// ─── POST /api/atlas/chat ─────────────────────────────────────
// Full multi-turn conversation with optional booking context.
//
// Body: {
//   messages: [{ role, content }],
//   context?: {
//     destination?: string,
//     budget?: number,
//     tripDays?: number,
//     bookingTotal?: number,
//     spent?: number,
//     flights?: Flight[]
//   }
// }
// Auth: required

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, context } = req.body;

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

    // Build context-aware system prompt
    const systemPrompt = buildContextualSystemPrompt(context || {});

    const reply = await atlasConverse(messages, systemPrompt);

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("[atlas/chat] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/atlas/query ────────────────────────────────────
// Single-turn quick query — cheaper + faster model.
//
// Body: { message: string, context?: object }
// Auth: required

router.post("/query", requireAuth, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res
        .status(400)
        .json({ error: "message must be a non-empty string." });
    }

    const systemPrompt = buildContextualSystemPrompt(context || {});
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

export default router;