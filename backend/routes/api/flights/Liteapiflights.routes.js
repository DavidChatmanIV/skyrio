import express from "express";
import {
  searchFlights,
  verifyOffer,
  createPrebook,
  attachPrebookServices,
  completeBooking,
} from "./Liteapiflights.controller.js";

const router = express.Router();

// LiteAPI Flights — now serving /api/flights (Duffel pending approval).
// Frontend calls GET /api/flights/search?from=...&to=...&departDate=...
router.get("/search", searchFlights);
router.post("/search", searchFlights); // also accept POST for direct/API use

// Booking flow — confirmed against LiteAPI's real endpoints via live
// validation errors. Call in order: verify -> prebook -> (services) -> complete.
router.post("/verify", verifyOffer); // 1. POST /api/flights/verify
router.post("/prebook", createPrebook); // 2. POST /api/flights/prebook
router.post("/prebook/:prebookId/services", attachPrebookServices); // 3. optional
router.post("/complete", completeBooking); // 4. POST /api/flights/complete

export default router;
