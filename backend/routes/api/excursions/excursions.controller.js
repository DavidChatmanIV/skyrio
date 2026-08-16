import { viator } from "./viator.provider.js";
import { isValidDate, normalizeExcursionList } from "./excursions.utils.js";

const AFFILIATE_CODE = process.env.VIATOR_AFFILIATE_CODE || null;

// ─────────────────────────────────────────────────────────────
// GET /api/excursions/destinations
//
// Resolves a place name into a Viator destinationId, which the
// search endpoint requires (mirrors the hotel /lookup step).
//
// Query params:
//   name — e.g. "Miami" (required)
//
// TODO: confirm actual Viator endpoint — commonly
// GET /destinations, returning a full flat list to search
// client-side (Viator's destination list rarely changes and is
// often meant to be cached in-memory, NOT per-request — this is
// static reference data, not "unique content," so caching this
// list specifically is fine).
// ─────────────────────────────────────────────────────────────
let destinationCache = null;
let destinationCacheAt = 0;
const DESTINATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export async function lookupDestination(req, res) {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "'name' is required (e.g. ?name=Miami)",
      });
    }

    const now = Date.now();
    if (
      !destinationCache ||
      now - destinationCacheAt > DESTINATION_CACHE_TTL_MS
    ) {
      const result = await viator.get("/destinations");
      destinationCache = result?.destinations ?? result?.data ?? [];
      destinationCacheAt = now;
    }

    const query = name.trim().toLowerCase();
    const matches = destinationCache
      .filter((d) => d.name?.toLowerCase().includes(query))
      .slice(0, 10)
      .map((d) => ({
        destinationId: d.destinationId ?? d.id,
        name: d.name,
        type: d.destinationType ?? d.type,
      }));

    return res.json({ ok: true, destinations: matches });
  } catch (err) {
    console.error("Viator destination lookup error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to look up destination",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/excursions/search
//
// Query params:
//   destinationId — Viator destination ID (required; use
//                   /api/excursions/destinations to resolve one
//                   from a place name)
//   startDate     — YYYY-MM-DD (optional)
//   endDate       — YYYY-MM-DD (optional)
//   category      — Viator tag/category id (optional)
//   minPrice, maxPrice — number (optional)
//   sort          — e.g. "TRAVELER_RATING", "PRICE_LOW_TO_HIGH" (optional)
//   page          — default 1
//   pageSize      — default 20, max 50 per Viator's docs
//
// TODO: confirm actual endpoint — commonly
// POST /products/search with a JSON body (not GET query params).
// If so, swap viator.get(...) below for viator.post("/products/search", body).
// ─────────────────────────────────────────────────────────────
export async function searchExcursions(req, res) {
  try {
    const {
      destinationId,
      startDate,
      endDate,
      category,
      minPrice,
      maxPrice,
      sort,
      page = "1",
      pageSize = "20",
    } = req.query;

    if (!destinationId) {
      return res.status(400).json({
        ok: false,
        message:
          "'destinationId' is required — resolve one via /api/excursions/destinations first",
      });
    }
    if (startDate && !isValidDate(startDate)) {
      return res
        .status(400)
        .json({ ok: false, message: "'startDate' must be YYYY-MM-DD" });
    }
    if (endDate && !isValidDate(endDate)) {
      return res
        .status(400)
        .json({ ok: false, message: "'endDate' must be YYYY-MM-DD" });
    }

    const pageSizeNum = Math.min(Number(pageSize) || 20, 50);

    const result = await viator.post("/products/search", {
      filtering: {
        destination: destinationId,
        tags: category ? [category] : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        price:
          minPrice || maxPrice
            ? {
                from: minPrice ? Number(minPrice) : undefined,
                to: maxPrice ? Number(maxPrice) : undefined,
              }
            : undefined,
      },
      sorting: sort ? { sort } : undefined,
      pagination: {
        start: (Number(page) - 1) * pageSizeNum + 1,
        count: pageSizeNum,
      },
      currency: "USD",
    });

    const products = result?.products ?? result?.data ?? [];
    const excursions = normalizeExcursionList(products, {
      affiliateCode: AFFILIATE_CODE,
    });

    return res.json({
      ok: true,
      count: excursions.length,
      totalCount: result?.totalCount ?? excursions.length,
      page: Number(page),
      excursions,
    });
  } catch (err) {
    console.error("Viator search error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to search excursions",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/excursions/:productCode
//
// Single product detail — for an excursion detail page/modal.
//
// TODO: confirm actual endpoint — commonly
// GET /products/{product-code}
// ─────────────────────────────────────────────────────────────
export async function getExcursionDetail(req, res) {
  try {
    const { productCode } = req.params;

    if (!productCode) {
      return res
        .status(400)
        .json({ ok: false, message: "'productCode' is required" });
    }

    const product = await viator.get(`/products/${productCode}`);
    const [excursion] = normalizeExcursionList([product], {
      affiliateCode: AFFILIATE_CODE,
    });

    if (!excursion) {
      return res
        .status(404)
        .json({ ok: false, message: "Excursion not found" });
    }

    return res.json({ ok: true, excursion });
  } catch (err) {
    console.error("Viator product detail error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to load excursion details",
      details: err?.details,
    });
  }
}
