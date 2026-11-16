// "Things to do during your trip": 2–3 Viator excursions for a trip's city
// and dates. Same Viator code as the Book page's Excursions tab.
//
// Runs next to the flight, hotel and event searches (see atlas.routes.js),
// so it adds no wait. Rules it enforces:
//   - only tours Viator says are available within the trip dates
//   - only tours with a real Viator link (the "View on Viator" button)
//   - nothing found, no Viator key, or Viator slow/down → [] (Atlas says nothing)
//   - the traveler's interests (Food, Adventure, Culture…) go first
// Viator's content is fetched live and never saved (affiliate terms).
import { viator as viatorClient } from "../../routes/api/excursions/viator.provider.js";
import { viatorDestinations } from "../../routes/api/excursions/excursions.controller.js";
import { normalizeExcursionList, isValidDate } from "../../routes/api/excursions/excursions.utils.js";
import { placeFor } from "./tripEvents.js";

export const MAX_TRIP_EXCURSIONS = 3;
const MAX_TRIP_DAYS = 31;

// Profile vibes → words that show up in matching tour titles.
const VIBE_WORDS = {
  food: /food|tasting|culinary|cooking|wine|rum|brewery|market/i,
  drink: /tasting|wine|rum|brewery|bar|cocktail/i,
  adventure: /snorkel|kayak|zip|atv|hike|dive|scuba|surf|jet ski|parasail|rafting/i,
  nature: /nature|wildlife|rainforest|park|bay|mangrove|waterfall|everglades|hike|bioluminescent/i,
  beach: /beach|boat|snorkel|catamaran|island|sail|cruise/i,
  culture: /history|historic|museum|walking tour|art|heritage|old town|architecture/i,
  history: /history|historic|museum|heritage|old town|fort/i,
  nightlife: /night|bar|pub crawl|club|sunset cruise/i,
  photography: /photo|sunset|scenic/i,
  family: /family|kids|zoo|aquarium/i,
  luxury: /private|vip|luxury|yacht/i,
  wellness: /yoga|spa|wellness/i,
};

/** Interest patterns from profile vibes, in the traveler's order. */
export function interestPatterns(vibes = []) {
  const out = [];
  for (const v of vibes || []) {
    for (const w of String(v || "").toLowerCase().split(/[^a-z]+/)) {
      const re = VIBE_WORDS[w];
      if (re && !out.includes(re)) out.push(re);
    }
  }
  return out;
}

/** Pick the Viator destination for a place: same name, a city first. */
export function matchDestination(list, place) {
  const want = String(place?.city || "").trim().toLowerCase();
  if (!want) return null;
  const same = (list || []).filter((d) => String(d?.name || "").trim().toLowerCase() === want);
  const pick =
    same.find((d) => /city/i.test(d.destinationType ?? d.type ?? "")) ||
    same[0] ||
    // Puerto Rico: the island as a whole if the city isn't listed.
    (place.countryCode === "PR" && (list || []).find((d) => /^puerto rico$/i.test(String(d?.name || "").trim())));
  return pick ? pick.destinationId ?? pick.id ?? null : null;
}

/** Pure: real, bookable tours; interests first, then best rated; cap. */
export function pickExcursions(items, { interests = [], max = MAX_TRIP_EXCURSIONS } = {}) {
  const rank = (x) => {
    const i = interests.findIndex((re) => re.test(x.title || ""));
    return i === -1 ? interests.length : i;
  };
  const score = (x) => (Number(x.rating) || 0) * Math.log10((Number(x.reviewCount) || 0) + 10);
  const seen = new Set();
  return (items || [])
    .filter((x) => x?.title && /^https:\/\//.test(String(x.bookingUrl || "")))
    .filter((x) => {
      const k = x.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => rank(a) - rank(b) || score(b) - score(a))
    .slice(0, max);
}

/** What Atlas and the card get: only fields from Viator's data. */
export const excursionView = (x) => ({
  title: x.title,
  priceFrom: Number.isFinite(Number(x.price)) && x.price != null ? Number(x.price) : null,
  currency: x.currency || "USD",
  rating: Number.isFinite(Number(x.rating)) && x.rating ? Math.round(Number(x.rating) * 10) / 10 : null,
  reviewCount: Number(x.reviewCount) || 0,
  duration: x.duration || null,
  freeCancellation: Boolean(x.cancellable),
  url: x.bookingUrl,
});

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const hasViatorKey = () =>
  Boolean(
    (process.env.VIATOR_ENV || "sandbox") === "production"
      ? process.env.VIATOR_PRODUCTION_KEY
      : process.env.VIATOR_SANDBOX_KEY
  );

/** → { place, start, end, excursions: [excursionView…] }. Never throws. */
export async function tripExcursions(
  { destination, airportCode, start, end, vibes = [] },
  { client = viatorClient, destinations = viatorDestinations, affiliateCode = process.env.VIATOR_AFFILIATE_CODE || null } = {}
) {
  const empty = { place: null, start, end, excursions: [] };
  if (client === viatorClient && !hasViatorKey()) return empty;
  if (!isValidDate(start) || !isValidDate(end) || end < start) return empty;
  if (daysBetween(start, end) > MAX_TRIP_DAYS) return empty;
  const place = placeFor({ destination, airportCode });
  if (!place) return empty;
  try {
    const destinationId = matchDestination(await destinations(), place);
    if (!destinationId) return empty;
    const result = await client.post("/products/search", {
      filtering: { destination: destinationId, startDate: start, endDate: end },
      sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
      pagination: { start: 1, count: 20 },
      currency: "USD",
    });
    const items = normalizeExcursionList(result?.products ?? result?.data ?? [], { affiliateCode });
    const picked = pickExcursions(items, { interests: interestPatterns(vibes) });
    return { place: place.label, start, end, excursions: picked.map(excursionView) };
  } catch (err) {
    console.warn("[Atlas trip excursions] skipped:", err.message);
    return empty;
  }
}
