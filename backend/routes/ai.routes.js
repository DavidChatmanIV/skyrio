import express from "express";

const router = express.Router();

/*
 Atlas AI Chat Route
 POST /api/ai/chat
*/
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages array required",
      });
    }

    // TEMP placeholder
    // Next step we connect OpenAI here
    return res.json({
      reply:
        "Atlas: Your request has been received. OpenAI connection will generate real travel plans.",
    });
  } catch (error) {
    console.error("Atlas AI error:", error);

    res.status(500).json({
      error: "Atlas AI server error",
    });
  }
});

export default router;
