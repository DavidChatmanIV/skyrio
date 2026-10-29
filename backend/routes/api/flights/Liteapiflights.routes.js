import express from "express";
import { optionalAuth } from "../../../middleware/requireAuth.js";
import { holdLimiter } from "../../../middleware/rateLimits.js";
import {
  searchFlights,
  warmSearch,
  verifyOffer,
  createPrebook,
  getPrebookDetails,
  attachPrebookServices,
  completeBooking,
} from "./Liteapiflights.controller.js";

const router = express.Router();

// GET /api/flights/search?from=EWR&to=ATL&departDate=2026-09-11&adults=1&cabin=economy
// POST /api/flights/search  (same params in body — useful for API clients)
router.get("/search", searchFlights);
router.post("/search", searchFlights);

// POST /api/flights/warm  (same params as search, query string or body)
// Starts the search in the background and returns 202 right away, so
// results are cached by the time the user actually runs the search.
router.post("/warm", warmSearch);

// Booking flow — call in order: verify -> prebook -> (get details -> services) -> complete
//
// Verify stays open: it only checks a fare's price/availability.
router.post("/verify", verifyOffer);

// Guests can book without an account. optionalAuth attaches the user when
// someone is signed in. /prebook hands back a checkout token, and every
// later step must send it (X-Checkout-Token); the controller checks it, so
// only whoever started a checkout can see or finish it.
router.post("/prebook", holdLimiter, optionalAuth, createPrebook);
// Fetches available seats/ancillaries + confirmed pricing for an
// existing prebook.
router.get("/prebook/:prebookId", optionalAuth, getPrebookDetails);
router.post(
  "/prebook/:prebookId/services",
  optionalAuth,
  attachPrebookServices
);
router.post("/complete", optionalAuth, completeBooking);

export default router;
