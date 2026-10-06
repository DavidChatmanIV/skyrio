import { Router } from "express";
import { requireAuth } from "../../../middleware/requireAuth.js";
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

// POST /api/hotels/prebook — standalone, manual testing
router.post("/prebook", prebookHotel);

// POST /api/hotels/book — standalone, manual testing (no payment)
router.post("/book", bookHotel);

// POST /api/hotels/checkout-intent — prebook + authorize-only Stripe PaymentIntent
router.post("/checkout-intent", requireAuth, initHotelCheckout);

// POST /api/hotels/confirm-booking — verify authorization, book with LiteAPI,
// then charge only for the rooms that were confirmed
router.post("/confirm-booking", requireAuth, confirmHotelBooking);

export default router;
