// backend/routes/atlasLearningRoutes.js
// Mount in server.js:
//   app.use("/api/atlas/learning", atlasLearningRoutes);
//   app.use("/api/atlas/feedback", atlasFeedbackRoutes);
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

export const atlasLearningRoutes = Router()
  .use(authRequired)
  .get("/", listLearning)
  .put("/settings", setLearningEnabled)
  .patch("/:id", updateLearning)
  .delete("/:id", deleteLearning)
  .delete("/", clearLearning);

export const atlasFeedbackRoutes = Router()
  .use(authRequired)
  .post("/", submitFeedback)
  .get("/insights", requireAdmin, getInsights)
  .patch("/:id/reviewed", requireAdmin, markReviewed);
