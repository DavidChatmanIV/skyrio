import express from "express";
import { requireAuth } from "../../../middleware/requireAuth.js";
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
router.post("/verify", verifyOffer);
router.post("/prebook", createPrebook);
// Fetches available seats/ancillaries + confirmed pricing for an
// existing prebook.
router.get("/prebook/:prebookId", getPrebookDetails);
router.post("/prebook/:prebookId/services", attachPrebookServices);
// requireAuth: the completed booking is saved to the signed-in user's account.
router.post("/complete", requireAuth, completeBooking);

export default router;
