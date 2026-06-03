/**
 * atlas.routes.js  —  backend/routes/atlas/atlas.routes.js
 *
 * Already mounted at /api/atlas in your index.js.
 * This adds POST /api/atlas/suggest which proxies to OpenAI.
 *
 * Your backend .env needs:
 *   OPENAI_API_KEY=sk-proj-xxxxxxxx
 */

import { Router } from "express";

const router = Router();

router.post("/suggest", async (req, res) => {
  try {
    const { prompt, homeCity, homeCode, promptHistory = [] } = req.body ?? {};

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const systemPrompt = `You are Atlas, Skyrio's AI travel planner.
Given a user's travel prompt and their home airport, return ONE suggested trip as a JSON object.

Rules:
- Be specific: real destinations, realistic pricing.
- Infer budget from the prompt (look for dollar amounts, words like "budget", "cheap", "luxury").
- If no budget is stated, pick a mid-range option appropriate to the destination.
- The "total" is a realistic all-in estimate (flights + hotel) in USD as an integer.
- "planKey" is a URL-safe slug like "tokyo-kyoto" or "tulum-5night".
- "fit" is a 2-5 word quality signal e.g. "Excellent budget match" or "Slightly over budget".
- "summary" is 1 sentence max 18 words describing the vibe and value.
- "dates" is a plausible window e.g. "Apr 5-15".
- Consider the user's prompt history to refine suggestions.

Respond ONLY with raw JSON — no markdown, no backticks, no preamble.

Schema: { "trip":"string", "dates":"string", "total":number, "fit":"string", "summary":"string", "planKey":"string" }`;

    const userMessage = `Home airport: ${homeCity ?? "Unknown"} (${
      homeCode ?? "?"
    })
Current prompt: "${prompt}"
${
  promptHistory.length > 1
    ? `Previous prompts this session:\n${promptHistory
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
          temperature: 0.7,
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

    res.json(result);
  } catch (err) {
    console.error("[Atlas suggest] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
