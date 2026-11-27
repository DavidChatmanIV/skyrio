import { viator } from "./viator.provider.js";
import { isValidDate, normalizeExcursionList } from "./excursions.utils.js";

const AFFILIATE_CODE = process.env.VIATOR_AFFILIATE_CODE || null;

// The Excursions tab's "What" choices. Viator's tag filter only takes its
// own numeric tag ids, so sending "food" matched nothing useful. Instead we
// fetch more and keep tours whose title/description fit the choice.
const CATEGORY_WORDS = {
  tours: /\btour|sightseeing|walking|guided|day trip|excursion/i,
  adventure: /snorkel|kayak|zip ?line|atv|hik(e|ing)|div(e|ing)|scuba|surf|jet ?ski|parasail|raft|climb|bike|horse|adventure/i,
  food: /food|tasting|culinary|cooking|wine|rum|beer|brewery|distillery|market|dinner|lunch|chocolate|coffee/i,
  culture: /histor|museum|cultur|heritage|old town|art\b|architecture|cathedral|fort|temple|castle|walking tour/i,
  wellness: /spa|yoga|wellness|massage|meditat|hot spring|retreat/i,
};
const matchesCategory = (x, re) => re.test(`${x.title || ""} ${x.shortDescription || ""}`);

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

/** Viator's destination list (static reference data, cached 24h). Shared with Atlas. */
export async function viatorDestinations() {
  const now = Date.now();
  if (!destinationCache || now - destinationCacheAt > DESTINATION_CACHE_TTL_MS) {
    const result = await viator.get("/destinations");
    const list = result?.destinations ?? result?.data ?? [];
    // An empty answer is never cached for a day (every lookup would fail).
    if (!Array.isArray(list) || !list.length) {
      console.warn("[excursions] Viator /destinations came back empty; keys:", Object.keys(result || {}));
      return Array.isArray(destinationCache) ? destinationCache : [];
    }
    destinationCache = list;
    destinationCacheAt = now;
  }
  return destinationCache;
}

// Best match first. Viator's list order is arbitrary, so "Iceland" used to
// land on a small region ("South Iceland") with few or no tours, instead of
// the country. Order: exact name, then names starting with the text, then
// names containing it; ties go to the broader place (country before region
// before city) and then the shorter name.
const TYPE_RANK = { COUNTRY: 0, REGION: 1, STATE: 1, CITY: 2, TOWN: 3 };
// Accent- and case-free text, so "Reykjavík" matches Viator's "Reykjavik"
// (and "Düsseldorf" / "Dusseldorf", "Bogotá" / "Bogota"…). Icelandic and
// Nordic letters that don't split into a base letter are spelled out.
const LETTERS = { ð: "d", þ: "th", æ: "ae", ø: "o", ß: "ss", ł: "l", đ: "d" };
export function plainText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[ðþæøßłđ]/g, (c) => LETTERS[c])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function rankDestinations(list = [], name = "") {
  const q = plainText(name);
  if (!q) return [];
  const score = (n) => (n === q ? 0 : n.startsWith(q) ? 1 : 2);
  return list
    .map((d) => ({
      destinationId: d.destinationId ?? d.id,
      name: d.name,
      type: d.destinationType ?? d.type,
      n: plainText(d.name),
    }))
    .filter((d) => d.destinationId != null && d.n.includes(q))
    .sort(
      (a, b) =>
        score(a.n) - score(b.n) ||
        (TYPE_RANK[String(a.type).toUpperCase()] ?? 4) - (TYPE_RANK[String(b.type).toUpperCase()] ?? 4) ||
        a.n.length - b.n.length
    )
    .map(({ n, ...d }) => d); // eslint-disable-line no-unused-vars
}

export async function lookupDestination(req, res) {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "'name' is required (e.g. ?name=Miami)",
      });
    }

    const list = await viatorDestinations();
    const matches = rankDestinations(list, name).slice(0, 10);
    // One line per lookup in the Render logs, to tell "Viator has no such
    // place" from "Skyrio's list didn't load".
    console.log(
      `[excursions] destination "${String(name).slice(0, 60)}" → ${matches.length} match(es)` +
        (matches.length ? `: ${matches.slice(0, 3).map((m) => `${m.name} (${m.type})`).join(", ")}` : "") +
        ` · list has ${list.length} places`
    );

    return res.json({ ok: true, destinations: matches });
  } catch (err) {
    console.error("Viator destination lookup error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Couldn't look up destination. Try again.",
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
    const wordFilter = category ? CATEGORY_WORDS[String(category).toLowerCase()] : null;
    const viatorTag = category && /^\d+$/.test(String(category)) ? [Number(category)] : undefined;

    const result = await viator.post("/products/search", {
      filtering: {
        destination: destinationId,
        tags: viatorTag,
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
      // A "What" choice filters after fetching, so ask for a full page.
      pagination: wordFilter
        ? { start: 1, count: 50 }
        : {
            start: (Number(page) - 1) * pageSizeNum + 1,
            count: pageSizeNum,
          },
      currency: "USD",
    });

    const products = result?.products ?? result?.data ?? [];
    const all = normalizeExcursionList(products, {
      affiliateCode: AFFILIATE_CODE,
    });
    const excursions = wordFilter
      ? all.filter((x) => matchesCategory(x, wordFilter)).slice(0, pageSizeNum)
      : all;

    return res.json({
      ok: true,
      count: excursions.length,
      totalCount: wordFilter ? excursions.length : result?.totalCount ?? excursions.length,
      page: Number(page),
      excursions,
    });
  } catch (err) {
    console.error("Viator search error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Couldn't search excursions. Try again.",
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
      message: err?.message || "Couldn't load excursion details. Try again.",
      details: err?.details,
    });
  }
}
