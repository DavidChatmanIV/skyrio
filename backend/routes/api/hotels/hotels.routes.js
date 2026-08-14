// ─────────────────────────────────────────────────────────────
// hotels.routes.js
// Thin router — all logic lives in hotels.controller.js
// ─────────────────────────────────────────────────────────────
import { Router } from "express";
import {
  searchHotels,
  prebookHotel,
  bookHotel,
  lookupHotelsByLocation,
  initHotelCheckout,
  confirmHotelBooking,
} from "./hotels.controller.js";

const router = Router();

// GET /api/hotels/lookup — destination → hotelIds
router.get("/lookup", lookupHotelsByLocation);

// GET /api/hotels/search
router.get("/search", searchHotels);

// POST /api/hotels/prebook — standalone, manual testing
router.post("/prebook", prebookHotel);

// POST /api/hotels/book — standalone, manual testing (no payment)
router.post("/book", bookHotel);

// POST /api/hotels/checkout-intent — prebook + create Stripe PaymentIntent
router.post("/checkout-intent", initHotelCheckout);

// POST /api/hotels/confirm-booking — verify payment, then book with LiteAPI
router.post("/confirm-booking", confirmHotelBooking);

export default router;
