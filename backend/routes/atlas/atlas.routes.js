/**
 * atlas.routes.js
 * ─────────────────────────────────────────────────────────────
 * All Atlas AI endpoints for Skyrio.
 * Mounted at /api/atlas
 *
 * Routes:
 *   POST  /api/atlas/chat              — multi-turn assistant (memory + tools)
 *   POST  /api/atlas/query             — single-turn quick answer
 *   GET   /api/atlas/health            — provider health check
 *   GET   /api/atlas/preferences       — view stored preferences
 *   DELETE /api/atlas/preferences/:id  — delete one preference
 *   DELETE /api/atlas/preferences      — clear all preferences
 *   POST  /api/atlas/trip-history      — add a completed trip
 *
 * v2 — Tool execution loop: Atlas can now cancel bookings,
 *       switch flights, issue refunds, look up FAQs, and
 *       escalate to human support — all through natural chat.
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  atlasConverse,
  atlasQuery,
  atlasHealthCheck,
  buildToolResultMessages,
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
import { ATLAS_TOOLS, executeAction } from "../../services/atlasActions.js";

const router = Router();

// ── Max tool-call loop iterations (safety valve) ──
const MAX_TOOL_ROUNDS = 5;

// ─── Dynamic system prompt builder (memory + context) ────────

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
        "just apply the preferences. If preferences conflict with their current " +
        "request, follow the current request — people change their minds."
    );
  } else if (memoryBrief.isNewUser) {
    lines.push("");
    lines.push(
      "── NEW USER ── This is a new user. Be welcoming. Pay attention to " +
        "preferences they reveal — the system will remember them for future conversations."
    );
  }

  // ── TRIP CONTEXT SECTION ──
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
        "Reference actual flight prices and availability when answering."
    );
  }

  return lines.join("\n");
}

// ═════════════════════════════════════════════════════════════
// TOOL EXECUTION LOOP
// This is the core engine that lets Atlas "do" things.
//
// 1. Send messages + tool definitions to the AI
// 2. If AI returns tool_calls → execute them
// 3. Feed results back → let AI respond or call more tools
// 4. Repeat up to MAX_TOOL_ROUNDS
// 5. Return the final text response
// ═════════════════════════════════════════════════════════════

async function runAtlasWithTools(messages, systemPrompt, userId) {
  let currentMessages = [...messages];
  let finalText = "";
  const actionsExecuted = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // ── Call Atlas with tools ──
    const result = await atlasConverse(
      currentMessages,
      systemPrompt,
      ATLAS_TOOLS
    );

    // ── No tool calls → Atlas is done, return text ──
    if (!result.toolCalls || result.toolCalls.length === 0) {
      finalText = result.text;
      break;
    }

    // ── Execute each tool call ──
    const toolResults = [];

    for (const tc of result.toolCalls) {
      console.log(
        `[atlas/chat] Tool call: ${tc.name}(${JSON.stringify(
          tc.arguments
        ).slice(0, 100)})`
      );

      const execResult = await executeAction(tc.name, tc.arguments, userId);

      toolResults.push({
        id: tc.id,
        name: tc.name,
        result: execResult,
      });

      actionsExecuted.push({
        tool: tc.name,
        success: execResult.success,
        round,
      });
    }

    // ── Feed results back to Atlas ──
    const resultMessages = buildToolResultMessages(
      result.provider,
      result,
      toolResults
    );

    currentMessages = [...currentMessages, ...resultMessages];

    // If this is the last allowed round, force a text response
    if (round === MAX_TOOL_ROUNDS - 1) {
      finalText =
        result.text ||
        "I've completed the actions. Let me know if you need anything else.";
    }
  }

  return { reply: finalText, actionsExecuted };
}

// ─── POST /api/atlas/chat ─────────────────────────────────────
// Full multi-turn conversation with memory + tools.

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, context } = req.body;
    const userId = req.auth?.sub || req.user?.sub || req.user?.id;

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

    // ── 1. Fetch user memory ──
    const memoryBrief = userId
      ? await getMemoryBrief(userId)
      : { summary: "", preferenceCount: 0, isNewUser: true };

    // ── 2. Build system prompt ──
    const systemPrompt = buildContextualSystemPrompt(
      context || {},
      memoryBrief
    );

    // ── 3. Run Atlas with tool execution loop ──
    const { reply, actionsExecuted } = await runAtlasWithTools(
      messages,
      systemPrompt,
      userId
    );

    // ── 4. Background: extract preferences + update stats ──
    if (userId) {
      extractPreferences(userId, messages).catch((err) =>
        console.error("[atlas/chat] Preference extraction failed:", err.message)
      );
      incrementMessageCount(userId).catch(() => {});
    }

    return res.json({
      ok: true,
      reply,
      memory: {
        preferenceCount: memoryBrief.preferenceCount,
        isNewUser: memoryBrief.isNewUser,
      },
      // Let the frontend know what Atlas did (for UI indicators)
      actions:
        actionsExecuted.length > 0
          ? actionsExecuted.map((a) => ({
              tool: a.tool,
              success: a.success,
            }))
          : null,
    });
  } catch (err) {
    console.error("[atlas/chat] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/atlas/query ────────────────────────────────────
// Single-turn quick query (no tools, no memory — lightweight).

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

// ═════════════════════════════════════════════════════════════
// PREFERENCE MANAGEMENT ENDPOINTS
// ═════════════════════════════════════════════════════════════

router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub || req.user?.id;
    const data = await getUserPreferences(userId);
    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error("[atlas/preferences] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/preferences/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub || req.user?.id;
    const deleted = await deletePreference(userId, req.params.id);
    return res.json({ ok: true, deleted });
  } catch (err) {
    console.error("[atlas/preferences] Delete error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub || req.user?.id;
    const cleared = await clearAllPreferences(userId);
    return res.json({ ok: true, cleared });
  } catch (err) {
    console.error("[atlas/preferences] Clear error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/trip-history", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub || req.user?.sub || req.user?.id;
    const added = await addTripToHistory(userId, req.body);
    return res.json({ ok: true, added });
  } catch (err) {
    console.error("[atlas/trip-history] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
