// GET /api/deals?origin=EWR&tripType=weekend
//
// Reads ONLY from the deal cache (DealSnapshot + HotelSnapshot) — fast,
// and no LiteAPI calls. For each destination it returns:
//   - the cheapest flight across the home base and its nearby airports
//     (EWR / JFK / LGA, etc.), plus how much less that was than the home base
//   - the cheapest well-rated hotel for the SAME dates, when one was found,
//     so the page can show "Flight + hotel" as one real trip.

import express from "express";
import DealSnapshot from "../models/DealSnapshot.js";
import HotelSnapshot from "../models/HotelSnapshot.js";
import {
  DESTINATION_BY_CODE,
  airportGroupFor,
  climateFor,
} from "../config/dealRoutes.js";

const router = express.Router();

const MAX_AGE_HOURS = 24; // older prices are too stale to show
const ENV = process.env.LITEAPI_ENV || "sandbox";

router.get("/", async (req, res) => {
  try {
    const origin = String(req.query.origin || "EWR")
      .toUpperCase()
      .slice(0, 3);
    const tripType = req.query.tripType === "getaway" ? "getaway" : "weekend";
    const group = airportGroupFor(origin);
    const since = new Date(Date.now() - MAX_AGE_HOURS * 3600 * 1000);

    const [rows, hotelRows] = await Promise.all([
      DealSnapshot.find({
        origin: { $in: group },
        tripType,
        env: ENV,
        foundAt: { $gte: since },
      }).lean(),
      HotelSnapshot.find({
        tripType,
        env: ENV,
        foundAt: { $gte: since },
      }).lean(),
    ]);
    const hotelByDest = new Map(hotelRows.map((h) => [h.destination, h]));

    // destination → { home: row from home airport, best: cheapest row in group }
    const byDest = new Map();
    for (const r of rows) {
      const entry = byDest.get(r.destination) || { home: null, best: null };
      if (r.origin === origin) entry.home = r;
      if (!entry.best || r.price < entry.best.price) entry.best = r;
      byDest.set(r.destination, entry);
    }

    const deals = [];
    for (const [code, { home, best }] of byDest) {
      const place = DESTINATION_BY_CODE[code];
      if (!place || !best) continue;
      const lessThanHome =
        home && best.origin !== origin
          ? Math.round(home.price - best.price)
          : 0;

      // Only pair a hotel whose dates match this flight exactly.
      const h = hotelByDest.get(code);
      const hotel =
        h && h.checkin === best.departDate && h.checkout === best.returnDate
          ? {
              name: h.hotelName,
              stars: h.stars,
              rating: h.rating,
              price: Math.round(h.price),
              payAtHotel: Math.round(h.payAtHotel || 0),
              foundAt: h.foundAt,
            }
          : null;

      deals.push({
        destination: code,
        city: place.city,
        lat: place.lat,
        lng: place.lng,
        tags: place.tags,
        // Typical high for the trip's month — drives "Warm weather".
        climate: climateFor(code, best.departDate),
        price: Math.round(best.price),
        currency: best.currency,
        fromCode: best.origin,
        savesVsHome: lessThanHome > 0 ? lessThanHome : 0,
        airline: best.airline,
        stops: best.stops,
        departDate: best.departDate,
        returnDate: best.returnDate,
        foundAt: best.foundAt,
        hotel,
        // Flight + hotel, 1 traveler and 1 room. Fees paid at the hotel
        // are NOT in this number; the page lists them separately.
        tripTotal: hotel ? Math.round(best.price) + hotel.price : null,
      });
    }
    deals.sort((a, b) => a.price - b.price);

    res.json({
      origin,
      nearby: group,
      tripType,
      // Sandbox fares are test data — the page labels them as a preview.
      preview: ENV !== "production",
      deals,
    });
  } catch (err) {
    console.error("[Deals] failed:", err);
    res.status(500).json({ error: "Couldn't load deals right now." });
  }
});

export default router;
