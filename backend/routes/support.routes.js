import { Router } from "express";
import {
  submitSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
  replyToSupportTicket,
} from "../controllers/support.controller.js";
import { verifyAdmin } from "./admin.routes.js";

const router = Router();

// POST /api/support — submit new support ticket (logged-in or anonymous)
router.post("/", submitSupportTicket);

// Everything below is admin-only: tickets hold people's names, emails and
// problems, so only the admin dashboard may read or change them.

// GET /api/support — list tickets (admin dashboard)
router.get("/", verifyAdmin, listSupportTickets);

// PATCH /api/support/:id/status — mark in_progress/resolved/closed
router.patch("/:id/status", verifyAdmin, updateSupportTicketStatus);

// PATCH /api/support/:id/reply — email a reply and/or save an internal note
router.patch("/:id/reply", verifyAdmin, replyToSupportTicket);

export default router;
