import { Router } from "express";
import {
  submitFeedback,
  listFeedback,
  updateFeedbackStatus,
} from "./feedback.controller.js";

const router = Router();

// POST /api/feedback — submit new feedback (works logged-in or anonymous)
router.post("/", submitFeedback);

// GET /api/feedback — list feedback (intended for your admin dashboard)
router.get("/", listFeedback);

// PATCH /api/feedback/:id/status — mark reviewed/actioned/dismissed
router.patch("/:id/status", updateFeedbackStatus);

export default router;
