/**
 * openaiProxy.js — add this route to your existing Express backend
 *
 * Place this file in your backend routes folder, then in your main
 * server.js add:
 *
 *   import openaiProxy from "./routes/openaiProxy.js";
 *   app.use("/api/openai", openaiProxy);
 *
 * Make sure OPENAI_API_KEY is in your backend .env file.
 */

import express from "express";

const router = express.Router();

router.post("/chat/completions", async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[OpenAI proxy] error from OpenAI:", data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("[OpenAI proxy] fetch failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
