// backend/routes/atlasLearningRoutes.js
// atlasLearningRoutes is mounted at /api/atlas/learning by routes/atlas/atlas.routes.js.
// (Feedback lives in atlas.routes.js; atlasFeedbackRoutes below is unused.)
import { Router } from "express";
import { authRequired, requireAdmin } from "../middleware/auth.js";
import {
  listLearning,
  updateLearning,
  deleteLearning,
  clearLearning,
  setLearningEnabled,
} from "../controllers/atlasLearningController.js";
import { submitFeedback, getInsights, markReviewed } from "../controllers/atlasFeedbackController.js";

// Express 4 doesn't catch errors in async handlers; answer instead of hanging.
const safe = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    console.error("[Atlas learning]", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Couldn't save. Try again." });
  }
};

export const atlasLearningRoutes = Router()
  .use(authRequired)
  .get("/", safe(listLearning))
  .put("/settings", safe(setLearningEnabled))
  .patch("/:id", safe(updateLearning))
  .delete("/:id", safe(deleteLearning))
  .delete("/", safe(clearLearning));

export const atlasFeedbackRoutes = Router()
  .use(authRequired)
  .post("/", submitFeedback)
  .get("/insights", requireAdmin, getInsights)
  .patch("/:id/reviewed", requireAdmin, markReviewed);
