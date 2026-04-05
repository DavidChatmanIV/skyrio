import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { city = "Newark" } = req.query;

    // Temporary response (we'll plug real API next)
    res.json({
      success: true,
      city,
      weather: "Sunny",
      temp: "75°F",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Weather fetch failed",
      error: err.message,
    });
  }
});

export default router;
