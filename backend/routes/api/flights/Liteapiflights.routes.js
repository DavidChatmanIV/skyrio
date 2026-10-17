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
//
// Verify stays open: it only checks a fare's price/availability.
router.post("/verify", verifyOffer);

// requireAuth on everything from prebook onward. /complete saves the
// booking to the signed-in user's account, so someone who isn't signed in
// must be stopped HERE — before a fare is reserved and a payment is set
// up — not after they've already paid. A signed-out request gets a 401,
// which the checkout turns into "Please sign in to book this flight."
router.post("/prebook", requireAuth, createPrebook);
// Fetches available seats/ancillaries + confirmed pricing for an
// existing prebook.
router.get("/prebook/:prebookId", requireAuth, getPrebookDetails);
router.post("/prebook/:prebookId/services", requireAuth, attachPrebookServices);
router.post("/complete", requireAuth, completeBooking);

export default router;
