// GET /api/deals?origin=EWR&tripType=weekend&maxPrice=300
//
// Reads ONLY from the DealSnapshot cache — fast, and no LiteAPI calls.
// For each destination it returns the cheapest fare across the home base
// and its nearby airports (EWR / JFK / LGA, etc.), plus how much that
// saves compared with flying from the home base itself.

import express from "express";
import DealSnapshot from "../models/DealSnapshot.js";
import { DESTINATION_BY_CODE, airportGroupFor } from "../config/dealRoutes.js";

const router = express.Router();

const MAX_AGE_HOURS = 24; // older prices are too stale to show
const ENV = process.env.LITEAPI_ENV || "sandbox";

router.get("/", async (req, res) => {
  try {
    const origin = String(req.query.origin || "EWR")
      .toUpperCase()
      .slice(0, 3);
    const tripType = req.query.tripType === "getaway" ? "getaway" : "weekend";
    const maxPrice = Number(req.query.maxPrice) || null;
    const group = airportGroupFor(origin);

    const since = new Date(Date.now() - MAX_AGE_HOURS * 3600 * 1000);
    const rows = await DealSnapshot.find({
      origin: { $in: group },
      tripType,
      env: ENV,
      foundAt: { $gte: since },
    }).lean();

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
      const savings =
        home && best.origin !== origin
          ? Math.round(home.price - best.price)
          : 0;
      deals.push({
        destination: code,
        city: place.city,
        lat: place.lat,
        lng: place.lng,
        tags: place.tags,
        price: Math.round(best.price),
        currency: best.currency,
        fromCode: best.origin,
        savesVsHome: savings > 0 ? savings : 0,
        airline: best.airline,
        stops: best.stops,
        departDate: best.departDate,
        returnDate: best.returnDate,
        foundAt: best.foundAt,
        fitsBudget: maxPrice ? best.price <= maxPrice : true,
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
