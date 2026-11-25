// "Usual price on Skyrio" for Where To Next.
//
// Built only from fares Skyrio itself found (the deal scan), never outside
// data. For each route + trip type it keeps the day's lowest fare, then:
//   usual range  = the middle half of past days' fares (25th–75th percentile)
//   lower than usual = today's fare is under that range AND at least 10%
//                      under the middle (median) price
// Nothing is said until there are MIN_DAYS of history, and nothing is ever
// said about a price being high.
import FareHistory from "../models/FareHistory.js";

export const MIN_DAYS = 14; // days of history before saying anything
export const WINDOW_DAYS = 60; // how far back "usual" looks
const KEEP_DAYS = 120;
const LOWER_BY = 0.1; // at least 10% under the median

const DAY_MS = 86400000;
const today = (now = new Date()) => now.toISOString().slice(0, 10);

/** Save today's fare for a route (keeps the lowest of the day). Never throws. */
export async function recordFare({ origin, destination, tripType, price, currency, departDate, returnDate, env }) {
  const p = Number(price);
  if (!(p > 0)) return;
  const now = new Date();
  try {
    await FareHistory.updateOne(
      { env, origin, destination, tripType, day: today(now) },
      {
        $min: { price: p },
        $setOnInsert: {
          currency: currency || "USD",
          departDate: departDate || null,
          returnDate: returnDate || null,
          expiresAt: new Date(now.getTime() + KEEP_DAYS * DAY_MS),
        },
      },
      { upsert: true }
    );
  } catch (e) {
    console.warn("[usualPrice] couldn't save fare:", e.message);
  }
}

function percentile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Usual range from past daily fares. → { low, high, median, days } or null */
export function usualFrom(prices) {
  const sorted = (prices || []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (sorted.length < MIN_DAYS) return null;
  return {
    low: Math.round(percentile(sorted, 0.25)),
    high: Math.round(percentile(sorted, 0.75)),
    median: Math.round(percentile(sorted, 0.5)),
    days: sorted.length,
  };
}

/** Is this fare clearly lower than usual? */
export function isLowerThanUsual(price, usual) {
  const p = Number(price);
  if (!usual || !(p > 0)) return false;
  return p < usual.low && p <= usual.median * (1 - LOWER_BY);
}

/**
 * Usual ranges for many routes at once (past days only, not today).
 * → Map("ORIGIN|DEST") → usual
 */
export async function usualPrices({ origins, tripType, env, now = new Date() }) {
  const from = today(new Date(now.getTime() - WINDOW_DAYS * DAY_MS));
  const rows = await FareHistory.find({
    env,
    tripType,
    origin: { $in: origins },
    day: { $gte: from, $lt: today(now) },
  })
    .select("origin destination price")
    .lean();
  const byRoute = new Map();
  for (const r of rows) {
    const k = `${r.origin}|${r.destination}`;
    if (!byRoute.has(k)) byRoute.set(k, []);
    byRoute.get(k).push(r.price);
  }
  const out = new Map();
  for (const [k, prices] of byRoute) {
    const u = usualFrom(prices);
    if (u) out.set(k, u);
  }
  return out;
}
