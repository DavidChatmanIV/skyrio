import { Router } from "express";
import jwt from "jsonwebtoken";
import { logEvent } from "../../services/eventService.js";
import {
  atlasChat,
  buildToolResultMessages,
  buildDefaultSystemPromptForHistory,
} from "../../services/atlasService.js";
import {
  ATLAS_SUPPORT_TOOLS,
  runAtlasTool,
} from "../../services/atlasTools.js";
import {
  buildPanelSystemPrompt,
  TRIP_TYPE_GUIDANCE,
} from "../../services/atlasPrompt.js";
import Booking from "../../models/booking.js";
import {
  ATLAS_BOOKING_TOOLS,
  isBookingTool,
  runBookingTool,
} from "../../services/atlas/atlasBookingTools.js";
import { ATLAS_BOOKING_PROMPT } from "../../services/atlas/atlasBookingPrompt.js";
import { buildLearnedContext } from "../../services/atlas/atlasLearning.js";
import authRequired from "../../middleware/authRequired.js";

const router = Router();

// Who's chatting, if they're signed in. The chat is open to everyone, so a
// missing or expired login just means "guest" — never an error.
function optionalUserId(req) {
  try {
    const header = String(req.headers.authorization || "");
    if (!/^bearer\s+/i.test(header)) return null;
    const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) return null;
    const d = jwt.verify(header.replace(/^bearer\s+/i, "").trim(), secret);
    const id = d?.id || d?._id || d?.userId || d?.sub || d?.user?.id || null;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Light rate limit — every Atlas call costs money, and these routes are
// open to logged-out visitors. Keyed by the visitor's IP (first entry of
// x-forwarded-for on Render). Generous enough for real people.
// ─────────────────────────────────────────────────────────────
const RATE_BUCKETS = new Map(); // key -> [timestamps]
function rateLimit({ name, max, windowMs }) {
  return (req, res, next) => {
    const ip =
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() ||
      req.ip ||
      "unknown";
    const key = `${name}:${ip}`;
    const now = Date.now();
    const hits = (RATE_BUCKETS.get(key) || []).filter(
      (t) => now - t < windowMs
    );
    if (hits.length >= max) {
      return res.status(429).json({
        ok: false,
        error:
          "You're sending messages quickly. Give Atlas a minute and try again.",
      });
    }
    hits.push(now);
    RATE_BUCKETS.set(key, hits);
    if (RATE_BUCKETS.size > 5000) {
      // Forget the oldest visitors so memory stays small.
      RATE_BUCKETS.delete(RATE_BUCKETS.keys().next().value);
    }
    next();
  };
}
const chatLimit = rateLimit({ name: "chat", max: 30, windowMs: 5 * 60 * 1000 });
const suggestLimit = rateLimit({
  name: "suggest",
  max: 60,
  windowMs: 5 * 60 * 1000,
});
const guideLimit = rateLimit({
  name: "guide",
  max: 30,
  windowMs: 5 * 60 * 1000,
});

// ─────────────────────────────────────────────────────────────
// Shared suggestion engine (used by /suggest and /picks)
// ─────────────────────────────────────────────────────────────

// Hard ceiling for an AI call someone is waiting on. If OpenAI is slow,
// fail with a clear error instead of an endless spinner.
const SUGGEST_TIMEOUT_MS = 9000;
// Background work nobody is waiting on (refreshing "Picked for you") can
// take longer.
const BACKGROUND_TIMEOUT_MS = 25000;

// Identical requests already in progress share one AI call.
const inflight = new Map(); // key -> Promise
function once(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Simple in-memory cache. Identical requests (the landing page's example
// seeds, the same prompt from the same airport, a user's picks) are
// answered instantly. Resets when the server restarts, which is fine.
const CACHE_MAX = 500;
const suggestCache = new Map(); // key -> { at, ttl, body }

function cacheGet(key) {
  const hit = suggestCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    suggestCache.delete(key);
    return null;
  }
  return hit.body;
}
function cacheSet(key, body, ttl) {
  if (suggestCache.size >= CACHE_MAX) {
    // Drop the oldest entry (Map keeps insertion order).
    suggestCache.delete(suggestCache.keys().next().value);
  }
  suggestCache.set(key, { at: Date.now(), ttl, body });
}

class SuggestError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// ── Search-ready trip data ──
// Every card carries what the booking page needs to search immediately:
// a destination airport code and real future dates (YYYY-MM-DD).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// What the plan books: flight + hotel together, a flight only, or a hotel only.
const PLAN_KINDS = ["package", "flight", "hotel"];
const IATA = /^[A-Z]{3}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
const toISO = (d) => d.toISOString().slice(0, 10);

// Checks the AI's dates. They must be real, start at least 7 days out (so
// flights are still bookable), end after they start, and last at most 30
// nights. Anything else is replaced with a sensible default window, so the
// booking page never receives a past or broken date.
function fixTripDates(depart, ret, nightsHint) {
  const minStart = new Date(todayUTC().getTime() + 7 * DAY_MS);
  const d = ISO_DATE.test(depart || "")
    ? new Date(`${depart}T00:00:00Z`)
    : null;
  const r = ISO_DATE.test(ret || "") ? new Date(`${ret}T00:00:00Z`) : null;
  const valid =
    d &&
    r &&
    !isNaN(d) &&
    !isNaN(r) &&
    d >= minStart &&
    r > d &&
    (r - d) / DAY_MS <= 30;
  if (valid)
    return {
      depart: toISO(d),
      return: toISO(r),
      nights: Math.round((r - d) / DAY_MS),
    };

  const nights = Math.min(Math.max(parseInt(nightsHint, 10) || 4, 1), 14);
  const start = new Date(todayUTC().getTime() + 30 * DAY_MS); // ~a month out
  const end = new Date(start.getTime() + nights * DAY_MS);
  return { depart: toISO(start), return: toISO(end), nights };
}

// "2026-11-20" + "2026-11-25" → "Nov 20–25" ; across months → "Nov 28 – Dec 3"
function formatDateRange(depart, ret) {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  const a = new Date(`${depart}T00:00:00Z`);
  const b = new Date(`${ret}T00:00:00Z`);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  return sameMonth
    ? `${a.toLocaleDateString("en-US", opts)}–${b.getUTCDate()}`
    : `${a.toLocaleDateString("en-US", opts)} – ${b.toLocaleDateString(
        "en-US",
        opts
      )}`;
}

// Keep only well-formed suggestions; never send the UI half-broken cards.
function cleanSuggestions(list, count) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && typeof s.trip === "string" && s.trip.trim())
    .slice(0, count)
    .map((s) => {
      const destCode = String(s.destCode || "")
        .trim()
        .toUpperCase();
      const when = fixTripDates(s.depart, s.return, s.nights);
      const kind = PLAN_KINDS.includes(s.kind) ? s.kind : "package";
      return {
        trip: String(s.trip).trim(),
        kind,
        destCode: IATA.test(destCode) ? destCode : null,
        depart: when.depart,
        return: when.return,
        nights: when.nights,
        dates: formatDateRange(when.depart, when.return),
        total: Number.isFinite(Number(s.total))
          ? Math.round(Number(s.total))
          : null,
        fit: String(s.fit || ""),
        summary: String(s.summary || ""),
        planKey: String(s.planKey || s.trip)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        score: Number.isFinite(Number(s.score)) ? Number(s.score) : null,
        // These are AI estimates, NOT live prices. Real prices come from
        // LiteAPI on the booking page. The UI labels them "est." because of this.
        estimated: true,
      };
    });
}

function buildSuggestSystemPrompt({
  count,
  typeGuidance = "",
  filterContext = "",
  extraRules = "",
}) {
  return `You are Atlas, Skyrio's AI travel planner.
Today's date is ${toISO(todayUTC())}.
Given a user's travel prompt, their home airport, and optional filters, return ${count} ranked trip suggestions.

Rules:
- Each suggestion must be a distinct destination or route — not just minor variations.
- Rank by best fit first (budget match, filter match, value for money).
- Infer budget from the prompt AND the budget filter if set.
- "kind" is what the traveler would book: "package" (round-trip flight + hotel), "flight" (flight only), or "hotel" (hotel only).
  If the prompt only asks about a stay/hotel, use "hotel"; if it only asks about flights, use "flight"; otherwise use "package".
- "total" is a realistic USD estimate as an integer that matches "kind": package = round-trip flights from the home airport + hotel for all nights; flight = round-trip airfare only; hotel = hotel for all nights only.
- "planKey" is a URL-safe slug e.g. "tokyo-kyoto-10d" or "tulum-5night".
- "fit" is 2-5 words e.g. "Excellent budget match", "Great adventure pick".
- "summary" is 1 sentence max 18 words describing the vibe and value.
- "trip" is the destination name only, e.g. "San Diego, CA" or "Lisbon, Portugal". No trip length in it.
- "destCode" is the 3-letter IATA code of the main airport for that destination, e.g. "SAN", "LIS", "MSY".
- "depart" and "return" are real dates in YYYY-MM-DD format, at least 2 weeks after today and within the next 6 months, in a good season for that place.
- "nights" is the number of nights between depart and return.
- "score" is 1-100 representing how well this matches the prompt + filters.
- Consider prompt history to understand the user's preferences.
- If no trip type is given, infer one from the prompt itself (e.g. "me and my wife" -> romantic, "my kids" -> family, "solo" / "by myself" -> solo, "my friends" / "our group" -> group) and let that inference quietly shape your picks without naming it back to the user.
- Keep every field short. No extra fields.
${extraRules}
${typeGuidance}
${filterContext ? `\nActive filters the user set: ${filterContext}` : ""}

Respond ONLY with a JSON object.

Schema:
{
  "suggestions": [
    {
      "trip": "string",
      "kind": "package" | "flight" | "hotel",
      "destCode": "string",
      "depart": "YYYY-MM-DD",
      "return": "YYYY-MM-DD",
      "nights": number,
      "total": number,
      "fit": "string",
      "summary": "string",
      "planKey": "string",
      "score": number
    }
  ]
}`;
}

// One OpenAI call → cleaned suggestions. Throws SuggestError on failure.
async function generateSuggestions({
  systemPrompt,
  userMessage,
  count,
  timeoutMs = SUGGEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let openaiRes;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        // Output length is the biggest driver of response time.
        // ~150 tokens per suggestion is plenty for this schema.
        max_tokens: 150 * count + 80,
        // Guarantees parseable JSON, so no failed JSON.parse on a stray backtick.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new SuggestError(
        504,
        "Atlas took too long to respond. Please try again."
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}));
    console.error("[Atlas] OpenAI error:", err);
    throw new SuggestError(openaiRes.status, "OpenAI request failed", err);
  }

  const data = await openaiRes.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const result = JSON.parse(clean);
  const list = Array.isArray(result?.suggestions)
    ? result.suggestions
    : [result];
  const suggestions = cleanSuggestions(list, count);
  if (!suggestions.length) {
    throw new SuggestError(502, "Atlas didn't return any usable suggestions.");
  }
  return { suggestions, tokens: data.usage?.completion_tokens };
}

// ─────────────────────────────────────────────────────────────
// POST /api/atlas/suggest — prompt-based suggestions (search box + examples)
// ─────────────────────────────────────────────────────────────
router.post("/suggest", suggestLimit, async (req, res) => {
  const t0 = Date.now();
  try {
    const {
      prompt,
      homeCity,
      homeCode,
      promptHistory = [],
      filters = {}, // { budget, type, duration }
      count: rawCount = 3, // how many suggestions to return
    } = req.body ?? {};

    if (!prompt || typeof prompt !== "string")
      return res.status(400).json({ error: "prompt is required" });
    if (prompt.length > 500)
      return res
        .status(400)
        .json({ error: "That's a long one. Keep it under 500 characters." });
    const count = Math.min(Math.max(parseInt(rawCount, 10) || 3, 1), 5);

    // Session history changes the answer, so only cache history-free requests.
    const cacheable =
      !Array.isArray(promptHistory) || promptHistory.length <= 1;
    const cacheKey = `suggest:${JSON.stringify({
      p: String(prompt).trim().toLowerCase(),
      h: homeCode || "",
      f: filters,
      c: count,
    })}`;
    if (cacheable) {
      const cached = cacheGet(cacheKey);
      if (cached) {
        const ms = Date.now() - t0;
        res.set("Server-Timing", `atlas;dur=${ms};desc="cache hit"`);
        console.log(`[Atlas suggest] ${ms}ms cache=hit`);
        return res.json(cached);
      }
    }

    const filterContext = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    // filters.type is expected to be one of: "solo" | "romantic" | "family" | "group"
    const typeGuidance = TRIP_TYPE_GUIDANCE[filters.type] || "";

    const systemPrompt = buildSuggestSystemPrompt({
      count,
      typeGuidance,
      filterContext,
    });
    const userMessage = `Home airport: ${homeCity ?? "Unknown"} (${
      homeCode ?? "?"
    })
Current prompt: "${prompt}"
${
  promptHistory.length > 1
    ? `Session history:\n${promptHistory
        .slice(0, -1)
        .map((p, i) => `  ${i + 1}. "${p}"`)
        .join("\n")}`
    : ""
}`;

    const run = () => generateSuggestions({ systemPrompt, userMessage, count });
    // Same question already being answered (e.g. many visitors loading the
    // landing page examples at once)? Share that answer.
    const { suggestions, tokens } = cacheable
      ? await once(cacheKey, run)
      : await run();
    const body = { suggestions };
    if (cacheable) cacheSet(cacheKey, body, 60 * 60 * 1000); // 1 hour

    const ms = Date.now() - t0;
    res.set("Server-Timing", `atlas;dur=${ms};desc="openai"`);
    // Grep your Render logs for "[Atlas suggest]" to see real response times.
    console.log(`[Atlas suggest] ${ms}ms cache=miss tokens=${tokens ?? "?"}`);
    return res.json(body);
  } catch (err) {
    console.error(
      `[Atlas suggest] error after ${Date.now() - t0}ms:`,
      err.message
    );
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/atlas/picks?homeCode=EWR&homeCity=Newark — signed-in only
// "Picked for you": suggestions shaped by the traveler's own bookings.
//
// Simple on purpose: no new models, no background jobs. It reads the
// traveler's recent confirmed bookings, turns them into a few plain
// sentences (where they go, what they usually spend, solo vs group),
// and hands that to the same suggestion engine as /suggest.
//
// Cached per user for 6 hours. The cache key includes their newest
// booking, so a new booking refreshes their picks automatically.
//
// Travelers with no bookings get { personalized: false } and the
// landing page shows the general example trips instead.
// ─────────────────────────────────────────────────────────────
const DEST_CODE = /→\s*([A-Z]{3})\b/; // "EWR → MIA · 2026-11-20" → "MIA"

function buildTravelProfile(trips) {
  const amounts = trips
    .map((t) => Number(t.totalAmount ?? t.total))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avg = amounts.length
    ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
    : null;

  const places = [
    ...new Set(
      trips
        .map((t) => (String(t.tripDetails || "").match(DEST_CODE) || [])[1])
        .filter(Boolean)
    ),
  ].slice(0, 6);

  const groupCount = trips.filter((t) => t.syncGroup).length;
  const style =
    groupCount === 0
      ? "travels solo (no group trips)"
      : groupCount > trips.length / 2
      ? "mostly takes group trips with friends"
      : "takes a mix of solo and group trips";

  const flights = trips.filter((t) => t.type === "Flight").length;
  const hotels = trips.filter((t) => t.type === "Hotel").length;
  const packages = trips.filter((t) => t.type === "Package").length;

  // How they book decides what kind of plans to suggest.
  const habit =
    packages > 0 || (flights > 0 && hotels > 0)
      ? 'books both flights and hotels. Make most suggestions "package"; one may be "flight" or "hotel".'
      : hotels > 0
      ? 'books hotels only (no flights on Skyrio). Make every suggestion "hotel", favoring places within driving distance or that pair well with their own travel.'
      : 'books flights only (no hotels on Skyrio yet). Make most suggestions "flight"; include one "package" so they can see a flight + hotel option.';

  const hotelNames = [
    ...new Set(
      trips
        .filter((t) => t.type === "Hotel")
        .map((t) => t.hotelStay?.rooms?.[0]?.name || t.tripDetails)
        .filter(Boolean)
    ),
  ].slice(0, 4);

  const lines = [
    `Has ${trips.length} recent booking${
      trips.length === 1 ? "" : "s"
    } on Skyrio (${flights} flight, ${hotels} hotel, ${packages} package).`,
    `Booking habit: ${habit}`,
    places.length
      ? `Recent flight destinations (airport codes, newest first): ${places.join(
          ", "
        )}.`
      : null,
    hotelNames.length ? `Recent hotel stays: ${hotelNames.join("; ")}.` : null,
    avg
      ? `Typically spends about $${avg} per booking (range $${Math.round(
          Math.min(...amounts)
        )}–$${Math.round(
          Math.max(...amounts)
        )}). Bookings are often flight-only, so an all-in trip total can be higher.`
      : null,
    `Style: ${style}.`,
  ].filter(Boolean);

  return { text: lines.join("\n"), places };
}

// How long picks are treated as current, and how long the last good set
// is kept to show instantly while a fresh set is made in the background.
const PICKS_FRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
const PICKS_KEEP_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// With nothing saved yet, wait this long for the AI before answering
// "not ready yet" so the page can show the general examples right away.
const PICKS_WAIT_MS = 2500;

function makePicks({ userId, homeCode, homeCity, trips }) {
  const count = 3;
  const storeKey = `picks:${userId}:${homeCode}`;
  return once(storeKey, async () => {
    const profile = buildTravelProfile(trips);
    const systemPrompt = buildSuggestSystemPrompt({
      count,
      extraRules: `- This is a personalized "Picked for you" request. Use the traveler profile below instead of a typed prompt.
- Match their budget style: keep "total" close to what someone with their spending habits would pay for a similar trip.
- Suggest places they have NOT already booked, in the spirit of the places they chose.
- If they mostly take group trips, favor group-friendly destinations; if solo, favor solo-friendly ones.
- Choose each suggestion's "kind" by following the "Booking habit" line in the profile.
- "fit" may point to their history (e.g. "Like your Miami trip", "Fits your usual budget"), but only mention destinations listed in the profile.`,
    });
    const userMessage = `Home airport: ${homeCity || "Unknown"} (${
      homeCode || "?"
    })
Traveler profile:
${profile.text}

Suggest ${count} trips this traveler would likely book next.`;

    const t0 = Date.now();
    const { suggestions, tokens } = await generateSuggestions({
      systemPrompt,
      userMessage,
      count,
      timeoutMs: BACKGROUND_TIMEOUT_MS,
    });
    const body = { personalized: true, basedOn: profile.places, suggestions };
    cacheSet(
      storeKey,
      { body, newestBooking: String(trips[0]._id), at: Date.now() },
      PICKS_KEEP_MS
    );
    console.log(
      `[Atlas picks] generated in ${Date.now() - t0}ms tokens=${tokens ?? "?"}`
    );
    return body;
  });
}

router.get("/picks", authRequired, async (req, res) => {
  const t0 = Date.now();
  try {
    const homeCode = String(req.query.homeCode || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
    const homeCity = String(req.query.homeCity || "")
      .replace(/[\r\n<>]/g, " ")
      .slice(0, 60);

    const trips = await Booking.find({
      user: req.user.id,
      status: { $in: ["confirmed", "cancel_pending"] },
    })
      .select(
        "_id tripDetails type total totalAmount syncGroup hotelStay.rooms.name createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    if (!trips.length) {
      return res.json({ personalized: false, suggestions: [] });
    }

    const args = { userId: req.user.id, homeCode, homeCity, trips };
    const saved = cacheGet(`picks:${req.user.id}:${homeCode}`);
    const isFresh =
      saved &&
      saved.newestBooking === String(trips[0]._id) &&
      Date.now() - saved.at < PICKS_FRESH_MS;

    // 1. Saved and current → instant.
    if (isFresh) {
      res.set("Server-Timing", `atlas;dur=${Date.now() - t0};desc="cache hit"`);
      return res.json(saved.body);
    }

    // 2. Saved but old (or a new booking since) → show it now, refresh
    //    quietly in the background for next time.
    if (saved) {
      makePicks(args).catch((e) =>
        console.warn("[Atlas picks] background refresh failed:", e.message)
      );
      res.set("Server-Timing", `atlas;dur=${Date.now() - t0};desc="stale"`);
      return res.json({ ...saved.body, refreshing: true });
    }

    // 3. Nothing saved yet → give the AI a short head start. If it isn't
    //    done, answer "pending" so the page shows the general examples now;
    //    the picks keep generating and are ready on the next check.
    const job = makePicks(args);
    job.catch((e) =>
      console.warn("[Atlas picks] generation failed:", e.message)
    );
    const winner = await Promise.race([
      job.then((body) => ({ body })).catch(() => ({ failed: true })),
      new Promise((r) => setTimeout(() => r({ timeout: true }), PICKS_WAIT_MS)),
    ]);
    res.set("Server-Timing", `atlas;dur=${Date.now() - t0};desc="openai"`);
    if (winner.body) return res.json(winner.body);
    return res.json({
      personalized: false,
      pending: !winner.failed,
      suggestions: [],
    });
  } catch (err) {
    console.error(
      `[Atlas picks] error after ${Date.now() - t0}ms:`,
      err.message
    );
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/atlas/chat
// General Atlas conversation. Used by AtlasPanel.jsx (floating
// widget) and SyncGroupPage.jsx (group trip planning).
//
// Body: { messages: [{ role, content }], systemPrompt?: string,
//         context?: object }
// Response: { ok: true, reply: string }
//
// NOW ROUTES THROUGH atlasService.js — respects ATLAS_PROVIDER /
// ATLAS_FALLBACK_PROVIDER and gets automatic Claude<->OpenAI failover.
//
// MODE DETECTION: AtlasPanel.jsx builds its own systemPrompt client-side
// (with intent-mode guidance already appended — see atlasTripModes.js),
// so when systemPrompt is present we use it as-is. Callers that don't
// send one (currently SyncGroupPage.jsx, which sends `context` instead)
// get buildDefaultSystemPromptForHistory(messages) — the server-side
// mode-detection path — instead of the raw, mode-blind default prompt.
// ─────────────────────────────────────────────────────────────

router.post("/chat", chatLimit, async (req, res) => {
  try {
    const { messages, context, source } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "messages array is required" });
    }

    // Only "user" and "assistant" turns, plain text, the last 20 messages,
    // each capped — keeps cost predictable and blocks oversized payloads.
    // The UI stores Atlas's turns as role "atlas"; providers need "assistant".
    const ROLE_MAP = { atlas: "assistant", ai: "assistant", bot: "assistant" };
    const normalizedMessages = messages
      .slice(-20)
      .map((m) => ({
        role: ROLE_MAP[m?.role] || m?.role,
        content: String(m?.content ?? "").slice(0, 4000),
      }))
      .filter(
        (m) => (m.role === "user" || m.role === "assistant") && m.content.trim()
      );
    // Providers expect the conversation to start with the traveler.
    while (normalizedMessages.length && normalizedMessages[0].role !== "user") {
      normalizedMessages.shift();
    }
    if (!normalizedMessages.length) {
      return res
        .status(400)
        .json({ ok: false, error: "Send a message for Atlas to answer." });
    }
    const lastUserText =
      [...normalizedMessages].reverse().find((m) => m.role === "user")
        ?.content || "";

    // Atlas's instructions are always built HERE. A systemPrompt sent by
    // the browser is ignored, so this route can't be repurposed.
    const userId = optionalUserId(req);
    let finalSystemPrompt;
    if (source === "panel") {
      finalSystemPrompt = buildPanelSystemPrompt(context || {}, lastUserText, {
        signedIn: Boolean(userId),
      });

      // Signed-in travelers: Atlas can book, set up their profile, and use
      // what it has learned about them (see services/atlas/*).
      if (userId) {
        finalSystemPrompt += `\n\n${ATLAS_BOOKING_PROMPT}`;
        const learned = await buildLearnedContext(userId).catch(() => "");
        if (learned) finalSystemPrompt += `\n\n${learned}`;

        // On a Sync Together page, the panel sends the trip id so Atlas can
        // call get_sync_trip without asking for it.
        const syncTripId = String(context?.syncTripId || "");
        if (/^[a-f0-9]{24}$/i.test(syncTripId)) {
          finalSystemPrompt += `\n\nThe traveler is looking at their Sync Together trip (syncTripId: ${syncTripId}). Use it with get_sync_trip and propose_booking when they want to book their share.`;
        }
      }
    } else {
      // Other callers (SyncGroupPage) send `context` as key/value facts.
      finalSystemPrompt =
        buildDefaultSystemPromptForHistory(normalizedMessages);
      if (context && typeof context === "object") {
        const ctxLines = Object.entries(context)
          .slice(0, 20)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(
            ([k, v]) =>
              `- ${String(k).slice(0, 40)}: ${String(
                typeof v === "object" ? JSON.stringify(v) : v
              )
                .replace(/[\r\n]+/g, " ")
                .slice(0, 300)}`
          )
          .join("\n");
        if (ctxLines) {
          finalSystemPrompt += `\n\nADDITIONAL CONTEXT:\n${ctxLines}`;
        }
      }
    }

    // Signed-in travelers in the chat panel get the support tools (look up
    // their bookings, bring up a cancel card) plus the booking tools (search,
    // propose a booking, set up their profile, remember preferences).
    // Guests just chat.
    const tools =
      source === "panel" && userId
        ? [...ATLAS_SUPPORT_TOOLS, ...ATLAS_BOOKING_TOOLS]
        : null;
    const actions = [];
    const toolsUsed = new Set();
    let convo = normalizedMessages;
    let result = null;

    // Up to 5 rounds: Atlas asks for a tool → we run it → Atlas answers.
    // Booking needs a few in one turn (profile → search → answer).
    for (let round = 0; round < 5; round++) {
      result = await atlasChat({
        systemPrompt: finalSystemPrompt,
        messages: convo,
        task: "default",
        maxTokens: 700,
        tools,
        // Tool replies must go back to the same provider that asked.
        ...(round > 0 && result?.provider ? { provider: result.provider } : {}),
      });
      if (!result?.toolCalls?.length) break;

      const toolResults = [];
      for (const call of result.toolCalls.slice(0, 4)) {
        toolsUsed.add(call.name);
        const ran = isBookingTool(call.name)
          ? await runBookingTool(call.name, call.arguments, { userId })
          : await runAtlasTool(call.name, call.arguments, { userId });
        if (ran.action && actions.length < 3) actions.push(ran.action);
        toolResults.push({ id: call.id, name: call.name, result: ran.result });
      }
      convo = [
        ...convo,
        ...buildToolResultMessages(result.provider, result, toolResults),
      ];
    }

    const reply =
      result?.text ||
      (actions.some((a) => a.type === "booking")
        ? "Here's your booking. Review the details and tap Confirm & Pay."
        : actions.some((a) => a.type === "profile_setup")
        ? "I opened a secure form below. Your details go straight to Skyrio."
        : actions.length
        ? "Here are the details. Check the refund on the card before you confirm."
        : "");
    if (!reply) {
      return res
        .status(500)
        .json({ ok: false, error: "Atlas returned an empty response" });
    }

    return res.json({
      ok: true,
      reply,
      actions,
      toolsUsed: [...toolsUsed],
      provider: result?.provider,
      model: result?.model,
    });
  } catch (err) {
    console.error("[Atlas chat] error:", err.message);
    res.status(500).json({
      ok: false,
      error: "Atlas couldn't answer just now. Please try again in a moment.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/atlas/destination-guide
// Lightweight destination guide — activities, tips, food.
// Logs destination_viewed / guide_generated for the shared
// event system (feeds email lifecycle + future personalization).
//
// Body: { destination: string }
// Response: { ok: true, guide: {...} }
// ─────────────────────────────────────────────────────────────
const GUIDE_TTL_MS = 24 * 60 * 60 * 1000; // a city's highlights don't change hourly

router.post("/destination-guide", guideLimit, async (req, res) => {
  try {
    const { destination } = req.body ?? {};
    const userId = req.user?.id; // assumes auth middleware sets req.user upstream

    if (!destination || typeof destination !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "destination is required" });
    }
    const place = destination
      .replace(/[\r\n<>]/g, " ")
      .trim()
      .slice(0, 80);
    if (!place) {
      return res
        .status(400)
        .json({ ok: false, error: "destination is required" });
    }
    const guideKey = `guide:${place.toLowerCase()}`;
    const cachedGuide = cacheGet(guideKey);
    if (cachedGuide) {
      if (userId)
        await logEvent(userId, "destination_viewed", { destination: place });
      return res.json({ ok: true, guide: cachedGuide });
    }

    // Log the view immediately — even if generation fails downstream,
    // this signal still matters for dormancy/email triggers later
    if (userId)
      await logEvent(userId, "destination_viewed", { destination: place });

    const systemPrompt = `You are Atlas, Skyrio's AI travel guide.
Given a destination, return a concise, practical guide.

Rules:
- "bestTime" is a short phrase e.g. "Apr-Jun and Sep-Oct".
- "activities" is an array of 3-4 short strings, each a specific must-do (not generic).
- "localTip" is 1 sentence of genuinely useful, non-obvious advice.
- "foodPick" is 1 specific dish or restaurant-type recommendation.
- "summary" is 1-2 sentences capturing the vibe. Max 30 words.
- Be specific and warm, never generic filler.
- If the place isn't a real travel destination, set "destination" to "" and leave the other fields empty.

Respond ONLY with raw JSON — no markdown, no backticks, no preamble.

Schema:
{
  "destination": "string",
  "summary": "string",
  "bestTime": "string",
  "activities": ["string"],
  "localTip": "string",
  "foodPick": "string"
}`;

    const guideController = new AbortController();
    const guideTimer = setTimeout(() => guideController.abort(), 15000);
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        signal: guideController.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 450,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Destination: ${place}` },
          ],
        }),
      }
    ).finally(() => clearTimeout(guideTimer));

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      console.error("[Atlas destination-guide] OpenAI error:", err);
      return res
        .status(openaiRes.status)
        .json({ ok: false, error: "OpenAI request failed", detail: err });
    }

    const data = await openaiRes.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const guide = JSON.parse(clean);
    if (!guide?.destination) {
      return res.status(404).json({
        ok: false,
        error: "Atlas couldn't find that place. Try a city or region name.",
      });
    }
    cacheSet(guideKey, guide, GUIDE_TTL_MS);

    if (userId)
      await logEvent(userId, "guide_generated", { destination: place });

    return res.json({ ok: true, guide });
  } catch (err) {
    console.error("[Atlas destination-guide] error:", err.message);
    res.status(500).json({
      ok: false,
      error:
        err.name === "AbortError"
          ? "Atlas took too long. Please try again."
          : "Atlas couldn't load that guide. Please try again.",
    });
  }
});

export default router;
