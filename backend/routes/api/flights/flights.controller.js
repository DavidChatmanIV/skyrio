// ─────────────────────────────────────────────────────────────
// flights.controller.js
// All Duffel business logic — imported by flights.routes.js
// ─────────────────────────────────────────────────────────────

import { duffel } from "./duffel.provider.js";
import {
  resolveIATA,
  DEFAULT_ORIGIN_IATA,
  normalizeDuffelOffer,
  buildSlices,
  buildPassengers,
} from "./flights.utils.js";

// ─────────────────────────────────────────────────────────────
// GET /api/flights/search
//
// Query params:
//   from        — IATA code OR city name (e.g. "EWR" or "New York")
//   to          — IATA code OR city name (e.g. "NRT" or "Tokyo")
//   departDate  — YYYY-MM-DD  (required)
//   returnDate  — YYYY-MM-DD  (optional)
//   adults      — number, default 1
//   cabin       — economy | premium_economy | business | first
//
// The `from` param is optional for auto-search — defaults to EWR.
// ─────────────────────────────────────────────────────────────
export async function searchFlights(req, res) {
  try {
    const {
      from = DEFAULT_ORIGIN_IATA,
      to,
      departDate,
      returnDate,
      adults = "1",
      cabin = "economy",
    } = req.query;

    // ── Validate required params ──
    if (!to) {
      return res.status(400).json({
        ok: false,
        message: "'to' (destination airport or city) is required",
      });
    }

    if (!departDate) {
      return res.status(400).json({
        ok: false,
        message: "'departDate' is required (YYYY-MM-DD)",
      });
    }

    // ── Resolve city names → IATA codes ──
    const originIATA = resolveIATA(from);
    const destIATA = resolveIATA(to);

    if (!originIATA) {
      return res.status(400).json({
        ok: false,
        message: `Could not resolve origin "${from}" to an IATA code`,
      });
    }

    if (!destIATA) {
      return res.status(400).json({
        ok: false,
        message: `Could not resolve destination "${to}" to an IATA code`,
      });
    }

    // ── Validate date format ──
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(departDate)) {
      return res.status(400).json({
        ok: false,
        message: "'departDate' must be in YYYY-MM-DD format",
      });
    }
    if (returnDate && !dateRegex.test(returnDate)) {
      return res.status(400).json({
        ok: false,
        message: "'returnDate' must be in YYYY-MM-DD format",
      });
    }

    // ── Validate adults ──
    const adultsNum = Number(adults);
    if (!Number.isInteger(adultsNum) || adultsNum < 1 || adultsNum > 9) {
      return res.status(400).json({
        ok: false,
        message: "'adults' must be an integer between 1 and 9",
      });
    }

    // ── Validate cabin ──
    const validCabins = ["economy", "premium_economy", "business", "first"];
    if (!validCabins.includes(cabin)) {
      return res.status(400).json({
        ok: false,
        message: `'cabin' must be one of: ${validCabins.join(", ")}`,
      });
    }

    // ── Build Duffel request ──
    const slices = buildSlices(originIATA, destIATA, departDate, returnDate);
    const passengers = buildPassengers(adultsNum);

    const offerRequest = await duffel.offerRequests.create({
      slices,
      passengers,
      cabin_class: cabin,
    });

    const offers = offerRequest.data.offers ?? [];

    // ── Normalize offers ──
    const flights = offers.map((offer) =>
      normalizeDuffelOffer(offer, originIATA, destIATA)
    );

    // ── Sort by price ascending ──
    flights.sort(
      (a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
    );

    return res.json({
      ok: true,
      offerRequestId: offerRequest.data.id,
      count: flights.length,
      origin: originIATA,
      destination: destIATA,
      flights,
    });
  } catch (err) {
    console.error("Duffel search error:", err);

    // Surface Duffel-specific error messages when available
    const duffelErrors = err?.errors ?? err?.meta?.errors;
    if (duffelErrors) {
      return res.status(502).json({
        ok: false,
        message: "Duffel API error",
        errors: duffelErrors,
      });
    }

    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to search flights",
    });
  }
}
