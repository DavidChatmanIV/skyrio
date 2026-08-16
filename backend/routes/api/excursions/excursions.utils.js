export function isValidDate(str) {
  if (!str || typeof str !== "string") return false;
  const d = new Date(str);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * Normalizes a single Viator product into Skyrio's excursion card shape.
 * Keeps only what the frontend needs to render + link out — does NOT
 * persist Viator's unique content, per affiliate API license terms.
 */
export function normalizeExcursion(product, { affiliateCode } = {}) {
  if (!product) return null;

  const productCode = product.productCode ?? product.code ?? null;

  const image =
    product.images?.[0]?.variants?.find((v) => v.width >= 480)?.url ??
    product.images?.[0]?.variants?.[0]?.url ??
    product.primaryImage ??
    null;

  const price =
    product.pricing?.summary?.fromPrice ??
    product.pricing?.summary?.fromPriceBeforeDiscount ??
    null;

  const currency = product.pricing?.currency ?? "USD";

  const rating = product.reviews?.combinedAverageRating ?? null;
  const reviewCount = product.reviews?.totalReviews ?? 0;

  const durationLabel =
    product.duration?.fixedDurationInMinutes != null
      ? formatDuration(product.duration.fixedDurationInMinutes)
      : product.duration?.description ?? null;

  const cancellable =
    product.bookingConfirmationSettings?.cancellationPolicy?.type === "STANDARD"
      ? true
      : Boolean(product.freeCancellation);

  // Affiliate deep-link — booking + payment happen on Viator's side.
  const bookingUrl = buildAffiliateLink(product.productUrl, affiliateCode);

  return {
    id: productCode,
    title: product.title ?? "Experience",
    shortDescription: pickEnglishDescription(product.description),
    image,
    price,
    currency,
    rating,
    reviewCount,
    duration: durationLabel,
    category: product.tags?.[0] ?? product.primaryCategory ?? null,
    cancellable,
    destination: product.destinations?.[0]?.name ?? null,
    bookingUrl,
  };
}

export function normalizeExcursionList(products = [], opts) {
  return products.map((p) => normalizeExcursion(p, opts)).filter(Boolean);
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

function truncate(str, len) {
  if (!str || str.length <= len) return str;
  return `${str.slice(0, len).trim()}…`;
}

// Viator aggregates listings from independent tour operators
// worldwide — descriptions arrive in whatever language the
// operator wrote them in, regardless of the Accept-Language
// header (that mainly affects Viator's own UI chrome, not every
// operator's free-text fields). Rather than show untranslated
// Spanish/French/etc. text in the middle of an English product,
// we do a lightweight heuristic check and simply omit the
// description if it doesn't look like English.
const ENGLISH_STOPWORDS = [
  " the ",
  " and ",
  " your ",
  " with ",
  " you ",
  " this ",
  " for ",
  " from ",
  " our ",
];
const NON_ENGLISH_MARKERS = [
  " el ",
  " la ",
  " los ",
  " las ",
  " una ",
  " para ",
  " esta ",
  " que ",
  " le ",
  " la ",
  " des ",
  " und ",
  " der ",
  " die ",
];

function pickEnglishDescription(text) {
  if (!text) return null;
  const truncated = truncate(text, 90);
  const padded = ` ${truncated.toLowerCase()} `;
  const englishHits = ENGLISH_STOPWORDS.filter((w) =>
    padded.includes(w)
  ).length;
  const nonEnglishHits = NON_ENGLISH_MARKERS.filter((w) =>
    padded.includes(w)
  ).length;
  if (nonEnglishHits > englishHits) return null;
  return truncated;
}

// TODO: confirm Viator's actual affiliate query param name
// (commonly "pid" or "mcid" depending on partner tier — check
// the Partner dashboard's own generated links for the exact key).
function buildAffiliateLink(productUrl, affiliateCode) {
  if (!productUrl) return null;
  if (!affiliateCode) return productUrl;
  const sep = productUrl.includes("?") ? "&" : "?";
  return `${productUrl}${sep}pid=${encodeURIComponent(affiliateCode)}`;
}
