// ─────────────────────────────────────────────────────────────
// flights.routes.js
// Thin router — all logic lives in flights.controller.js
import { Router } from "express";
import { searchFlights } from "./flights.controller.js";

const router = Router();

// GET /api/flights/search
router.get("/search", searchFlights);

export default router;