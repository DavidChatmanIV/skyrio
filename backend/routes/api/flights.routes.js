import { Router } from "express";
import { duffel } from "../../services/providers/flights/duffel.provider.js";

const router = Router();

// GET /api/flights/search?from=EWR&to=MIA&departDate=2026-04-20&returnDate=2026-04-25&adults=1&cabin=economy
router.get("/search", async (req, res) => {
  try {
    const {
      from,
      to,
      departDate,
      returnDate,
      adults = "1",
      cabin = "economy",
    } = req.query;

    if (!from || !to || !departDate) {
      return res.status(400).json({
        message: "from, to, and departDate are required",
      });
    }

    const slices = [
      {
        origin: from,
        destination: to,
        departure_date: departDate,
      },
    ];

    if (returnDate) {
      slices.push({
        origin: to,
        destination: from,
        departure_date: returnDate,
      });
    }

    const passengers = Array.from({ length: Number(adults) }).map(() => ({
      type: "adult",
    }));

    const offerRequest = await duffel.offerRequests.create({
      slices,
      passengers,
      cabin_class: cabin,
    });

    const offers = offerRequest.data.offers ?? [];

    const normalized = offers.map((offer) => {
      const outbound = offer.slices?.[0];
      const outboundSegments = outbound?.segments ?? [];
      const firstSeg = outboundSegments[0];
      const lastSeg = outboundSegments[outboundSegments.length - 1];

      return {
        id: offer.id,
        owner: offer.owner?.name ?? "Unknown airline",
        ownerCode: offer.owner?.iata_code ?? "",
        totalAmount: offer.total_amount,
        totalCurrency: offer.total_currency,
        expiresAt: offer.expires_at,

        origin: firstSeg?.origin?.iata_code ?? from,
        destination: lastSeg?.destination?.iata_code ?? to,
        departingAt: firstSeg?.departing_at ?? null,
        arrivingAt: lastSeg?.arriving_at ?? null,

        stops: Math.max(outboundSegments.length - 1, 0),
        slices: offer.slices ?? [],
        raw: offer,
      };
    });

    return res.json({
      ok: true,
      offerRequestId: offerRequest.data.id,
      count: normalized.length,
      flights: normalized,
    });
  } catch (err) {
    console.error("Duffel search error:", err);

    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to search flights",
    });
  }
});

export default router;