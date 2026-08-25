import express from "express";
import {
  searchFlights,
  verifyOffer,
  createPrebook,
  attachPrebookServices,
  completeBooking,
} from "./Liteapiflights.controller.js";

const router = express.Router();

// GET /api/flights/search?from=EWR&to=ATL&departDate=2026-09-11&adults=1&cabin=economy
// POST /api/flights/search  (same params in body — useful for API clients)
router.get("/search", searchFlights);
router.post("/search", searchFlights);

// Booking flow — call in order: verify -> prebook -> (services) -> complete
router.post("/verify", verifyOffer);
router.post("/prebook", createPrebook);
router.post("/prebook/:prebookId/services", attachPrebookServices);
router.post("/complete", completeBooking);

export default router;
