// middleware/draftRateLimit.js
// Simple in-memory limiter so anonymous visitors can't burn through LiteAPI
// prebooks. Fine for a single Render instance; swap for Redis if you scale out.

const buckets = new Map();

function keyFor({ userId, guestKeyHash, ip }) {
  if (userId) return `u:${userId}`;
  if (guestKeyHash) return `g:${guestKeyHash}`;
  return `ip:${ip}`;
}

export function limiter({ windowMs, guestMax, userMax }) {
  // Returns true if allowed (and records the hit), false if over the limit.
  function tryConsume(identity) {
    const key = keyFor(identity);
    const max = identity.userId ? userMax : guestMax;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) return false;
    hits.push(now);
    buckets.set(key, hits);
    return true;
  }

  function middleware(req, res, next) {
    const ok = tryConsume({
      userId: req.user?._id ? String(req.user._id) : null,
      guestKeyHash: req.guestKeyHash,
      ip: req.ip,
    });
    if (!ok) {
      return res.status(429).json({
        error: "rate_limited",
        message: "Too many price checks in a short time. Try again in a few minutes.",
      });
    }
    next();
  }

  middleware.tryConsume = tryConsume;
  return middleware;
}

// Housekeeping so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, hits] of buckets) {
    if (!hits.some((t) => t > cutoff)) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref();

// Used by both the Atlas tool and the routes.
export const draftCreateLimit = limiter({ windowMs: 60 * 60 * 1000, guestMax: 8, userMax: 30 });

