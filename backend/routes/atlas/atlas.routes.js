/**
 * atlas.routes.js  —  backend/routes/atlas/atlas.routes.js
 *
 * POST /api/atlas/suggest
 * Returns up to 3 ranked trip suggestions based on prompt + filters.
 */

import { Router } from "express";

const router = Router();

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

export default router;
