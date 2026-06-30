/**
 * atlas.routes.js  —  backend/routes/atlas/atlas.routes.js
 *
 * POST /api/atlas/suggest
 * Returns up to 3 ranked trip suggestions based on prompt + filters.
 *
 * POST /api/atlas/chat
 * General-purpose Atlas conversation used by the floating AtlasPanel
 * widget and the SyncTogether group planner.
 */

import { Router } from "express";

const router = Router();

// Trip-type-specific guidance injected into the system prompt.
// Keyed to filters.type — see TRIP_TYPE_GUIDANCE below.
const TRIP_TYPE_GUIDANCE = {
  solo: `
This is a SOLO trip. Favor destinations with strong safety reputations,
walkable city centers or well-trodden routes, and good opportunities to
meet other travelers if desired (hostels, group tours, co-working cafes).
Avoid suggesting destinations requiring a private car/driver as the only
way to get around.`,
  romantic: `
This is a ROMANTIC trip (couple). Favor destinations and stays with
privacy, ambiance, and a clear "experience" factor (sunset dinners,
scenic viewpoints, boutique stays) over high-volume tourist hubs. If the
prompt mentions an anniversary/proposal/honeymoon, weight that heavily
in the "fit" and "summary" fields.`,
  family: `
This is a FAMILY trip (parents + kids). Favor destinations with
kid-friendly infrastructure: short transit times, stroller/car-seat
accessible transport, family room configurations, and activities
suitable for mixed ages. Penalize destinations known for being
logistically hard with young children (e.g. long transfer times, no
direct flights) unless the prompt specifically asks for adventure.`,
  group: `
This is a GROUP trip (multiple independent travelers, possibly multiple
families). Favor destinations with a range of activities so different
sub-groups can split off and reconvene, flexible group-size lodging
(villas, multi-room hotels), and reasonably central locations that don't
require everyone to agree on one single narrow activity.`,
};

router.post("/suggest", async (req, res) => {
  try {
    const {
      prompt,
      homeCity,
      homeCode,
      promptHistory = [],
      filters = {}, // { budget, type, duration }
      count = 3, // how many suggestions to return
    } = req.body ?? {};

    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    // Build a filter context string for the AI
    const filterContext = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    // Pull trip-type-specific guidance if filters.type matches a known type.
    // filters.type is expected to be one of: "solo" | "romantic" | "family" | "group"
    const typeGuidance = TRIP_TYPE_GUIDANCE[filters.type] || "";

    // Build a filter context string for the AI
    const systemPrompt = `You are Atlas, Skyrio's AI travel planner.
Given a user's travel prompt, their home airport, and optional filters, return ${count} ranked trip suggestions.

Rules:
- Each suggestion must be a distinct destination or route — not just minor variations.
- Rank by best fit first (budget match, filter match, value for money).
- Infer budget from the prompt AND the budget filter if set.
- "total" is a realistic all-in USD estimate (flights from the home airport + hotel) as an integer.
- "planKey" is a URL-safe slug e.g. "tokyo-kyoto-10d" or "tulum-5night".
- "fit" is 2-5 words e.g. "Excellent budget match", "Great adventure pick".
- "summary" is 1 sentence max 18 words describing the vibe and value.
- "dates" is a plausible window e.g. "Apr 5-15".
- "score" is 1-100 representing how well this matches the prompt + filters.
- Consider prompt history to understand the user's preferences.
- If no trip type is given, infer one from the prompt itself (e.g. "me and my wife" -> romantic, "my kids" -> family, "solo" / "by myself" -> solo, "my friends" / "our group" -> group) and let that inference quietly shape your picks without naming it back to the user.
${typeGuidance}
${filterContext ? `\nActive filters the user set: ${filterContext}` : ""}

Respond ONLY with raw JSON — no markdown, no backticks, no preamble.

Schema:
{
  "suggestions": [
    {
      "trip": "string",
      "dates": "string",
      "total": number,
      "fit": "string",
      "summary": "string",
      "planKey": "string",
      "score": number
    }
  ]
}`;

    const userMessage = `Home airport: ${homeCity ?? "Unknown"} (${
      homeCode ?? "?"
    })
Current prompt: "${prompt}"
${
  promptHistory.length > 1
    ? `Session history:\n${promptHistory
        .slice(0, -1)
        .map((p, i) => `  ${i + 1}. "${p}"`)
        .join("\n")}`
    : ""
}`;

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.75,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      }
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      console.error("[Atlas suggest] OpenAI error:", err);
      return res
        .status(openaiRes.status)
        .json({ error: "OpenAI request failed", detail: err });
    }

    const data = await openaiRes.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const result = JSON.parse(clean);

    // Ensure we always return the { suggestions: [...] } shape
    if (Array.isArray(result?.suggestions)) {
      return res.json(result);
    }
    // Fallback: if model returned a single object, wrap it
    return res.json({ suggestions: [result] });
  } catch (err) {
    console.error("[Atlas suggest] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/atlas/chat
// General Atlas conversation. Used by AtlasPanel.jsx (floating
// widget) and SyncGroupPage.jsx (group trip planning).
//
// Body: { messages: [{ role, content }], systemPrompt?: string,
//         context?: object }
// Response: { ok: true, reply: string }
// ─────────────────────────────────────────────────────────────
const DEFAULT_CHAT_SYSTEM_PROMPT = `You are Atlas, Skyrio's AI travel companion. Be sharp, warm, and direct. Keep responses concise unless the user asks for detail.`;

router.post("/chat", async (req, res) => {
  try {
    const { messages, systemPrompt, context } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "messages array is required" });
    }

    // Some callers (SyncGroupPage) send `context` separately instead of
    // baking it into systemPrompt — fold it in if present.
    let finalSystemPrompt = systemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
    if (context && typeof context === "object") {
      const ctxLines = Object.entries(context)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n");
      if (ctxLines) {
        finalSystemPrompt += `\n\nADDITIONAL CONTEXT:\n${ctxLines}`;
      }
    }

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            { role: "system", content: finalSystemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      }
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      console.error("[Atlas chat] OpenAI error:", err);
      return res
        .status(openaiRes.status)
        .json({ ok: false, error: "OpenAI request failed", detail: err });
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res
        .status(500)
        .json({ ok: false, error: "Atlas returned an empty response" });
    }

    return res.json({ ok: true, reply });
  } catch (err) {
    console.error("[Atlas chat] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
