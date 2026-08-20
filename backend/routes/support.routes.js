import { Router } from "express";
import {
  submitSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
  replyToSupportTicket,
} from "../controllers/support.controller.js";

const router = Router();

// POST /api/support — submit new support ticket (works logged-in or anonymous)
router.post("/", submitSupportTicket);

// GET /api/support — list tickets (admin dashboard)
router.get("/", listSupportTickets);

// PATCH /api/support/:id/status — mark in_progress/resolved/closed
router.patch("/:id/status", updateSupportTicketStatus);

// PATCH /api/support/:id/reply — leave a reply/internal note
router.patch("/:id/reply", replyToSupportTicket);

export default router;
