import { Router } from "express";
import { optionalAuth } from "../../../middleware/requireAuth.js";
import { verifyAdmin } from "../../../middleware/auth.js";
import { holdLimiter } from "../../../middleware/rateLimits.js";
import {
  searchHotels,
  prebookHotel,
  bookHotel,
  lookupHotelsByLocation,
  searchPlaces,
  initHotelCheckout,
  confirmHotelBooking,
} from "./hotels.controller.js";

const router = Router();

// GET /api/hotels/lookup — destination → hotelIds
router.get("/lookup", lookupHotelsByLocation);

// GET /api/hotels/places — free-text location autocomplete (billed
// per-request by LiteAPI; see searchPlaces for cost notes)
router.get("/places", searchPlaces);

// GET /api/hotels/search
router.get("/search", searchHotels);

// POST /api/hotels/prebook — standalone, manual testing. Admin-only.
router.post("/prebook", verifyAdmin, prebookHotel);

// POST /api/hotels/book — standalone, manual testing (no payment).
// Admin-only: it books with ACC_CREDIT_CARD, so Skyrio's own card pays.
// Left open, anyone who found this URL could book rooms on that card.
router.post("/book", verifyAdmin, bookHotel);

// POST /api/hotels/checkout-intent — prebook + authorize-only Stripe
// PaymentIntent. Guests can book; returns a checkout token.
router.post("/checkout-intent", holdLimiter, optionalAuth, initHotelCheckout);

// POST /api/hotels/confirm-booking — verify authorization, book with LiteAPI,
// then charge only for the rooms that were confirmed. Needs the checkout
// token from /checkout-intent (X-Checkout-Token).
router.post("/confirm-booking", optionalAuth, confirmHotelBooking);

export default router;
