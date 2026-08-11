const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const { logEvent } = require("../services/eventService");
const authenticateUser = require("../middleware/auth"); // however you're gating this

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post(
  "/api/atlas/destination-guide",
  authenticateUser,
  async (req, res) => {
    const { destination } = req.body;
    const userId = req.user.id;

    if (!destination || typeof destination !== "string") {
      return res.status(400).json({ error: "Destination is required" });
    }

    try {
      // Log the view immediately — even if generation fails downstream,
      // you still want to know they were interested in this destination
      await logEvent(userId, "destination_viewed", { destination });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // cheap/fast is fine for this, no need for full model
        messages: [
          {
            role: "system",
            content: `You are Atlas, Skyrio's travel guide assistant. Give a concise, 
practical destination guide: best time to visit, 3-4 must-do activities/excursions, 
one local tip, and one food recommendation. Keep it warm and specific, not generic. 
No markdown headers, just clean paragraphs.`,
          },
          {
            role: "user",
            content: `Give me a destination guide for ${destination}.`,
          },
        ],
        max_tokens: 500,
      });

      const guideText = completion.choices[0].message.content;

      // Log successful generation — this is the event email/PWA will
      // eventually key off of (e.g. "sent you a guide, come back and plan")
      await logEvent(userId, "guide_generated", { destination });

      res.json({ destination, guide: guideText });
    } catch (err) {
      console.error("Destination guide error:", err.message);
      res.status(500).json({ error: "Could not generate guide right now" });
    }
  }
);

module.exports = router;
