import { Router } from "express";
import { logEvent } from "../../services/eventService.js";
import {
  atlasChat,
  ATLAS_DEFAULT_SYSTEM_PROMPT,
  buildDefaultSystemPromptForHistory,
} from "../../services/atlasService.js";
import Booking from "../../models/booking.js";
import authRequired from "../../middleware/authRequired.js";

const router = Router();

// Trip-type-specific guidance injected into the system prompt.
// Keyed to filters.type — see TRIP_TYPE_GUIDANCE below.
const TRIP_TYPE_GUIDANCE = {
  solo: `
This is a SOLO trip. Favor destinations with strong safety reputations,
walkable city centers or well-trodden routes, and good opportunities to
meet other travelers if desired (hostels, group tours, co-working cafes).
Avoid suggesting destinations requiring a private car/driver as the only
way to get around.`,
  romantic: `
This is a ROMANTIC trip (couple). Favor destinations and stays with
privacy, ambiance, and a clear "experience" factor (sunset dinners,
scenic viewpoints, boutique stays) over high-volume tourist hubs. If the
prompt mentions an anniversary/proposal/honeymoon, weight that heavily
in the "fit" and "summary" fields.`,
  family: `
This is a FAMILY trip (parents + kids). Favor destinations with
kid-friendly infrastructure: short transit times, stroller/car-seat
accessible transport, family room configurations, and activities
suitable for mixed ages. Penalize destinations known for being
logistically hard with young children (e.g. long transfer times, no
direct flights) unless the prompt specifically asks for adventure.`,
  group: `
This is a GROUP trip (multiple independent travelers, possibly multiple
families). Favor destinations with a range of activities so different
sub-groups can split off and reconvene, flexible group-size lodging
(villas, multi-room hotels), and reasonably central locations that don't
require everyone to agree on one single narrow activity.`,
};

// ─────────────────────────────────────────────────────────────
// Shared suggestion engine (used by /suggest and /picks)
// ─────────────────────────────────────────────────────────────

// Hard ceiling for the AI call. If OpenAI is slow, fail fast with a clear
// error instead of leaving the traveler staring at a spinner.
const SUGGEST_TIMEOUT_MS = 7000;

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
async function generateSuggestions({ systemPrompt, userMessage, count }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
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
router.post("/suggest", async (req, res) => {
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

    if (!prompt) return res.status(400).json({ error: "prompt is required" });
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

    const { suggestions, tokens } = await generateSuggestions({
      systemPrompt,
      userMessage,
      count,
    });
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

router.get("/picks", authRequired, async (req, res) => {
  const t0 = Date.now();
  try {
    const homeCode = String(req.query.homeCode || "")
      .toUpperCase()
      .slice(0, 4);
    const homeCity = String(req.query.homeCity || "").slice(0, 60);
    const count = 3;

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

    const cacheKey = `picks:${req.user.id}:${homeCode}:${trips[0]._id}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      const ms = Date.now() - t0;
      res.set("Server-Timing", `atlas;dur=${ms};desc="cache hit"`);
      console.log(`[Atlas picks] ${ms}ms cache=hit`);
      return res.json(cached);
    }

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

    const { suggestions, tokens } = await generateSuggestions({
      systemPrompt,
      userMessage,
      count,
    });
    const body = { personalized: true, basedOn: profile.places, suggestions };
    cacheSet(cacheKey, body, 6 * 60 * 60 * 1000); // 6 hours

    const ms = Date.now() - t0;
    res.set("Server-Timing", `atlas;dur=${ms};desc="openai"`);
    console.log(`[Atlas picks] ${ms}ms cache=miss tokens=${tokens ?? "?"}`);
    return res.json(body);
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

router.post("/chat", async (req, res) => {
  try {
    const { messages, systemPrompt, context } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "messages array is required" });
    }

    // Some callers (SyncGroupPage) send `context` separately instead of
    // baking it into systemPrompt — fold it in if present. When no
    // systemPrompt is supplied at all, fall back to the mode-aware
    // default (detects intent from the latest user message) rather than
    // the raw ATLAS_DEFAULT_SYSTEM_PROMPT.
    let finalSystemPrompt =
      systemPrompt || buildDefaultSystemPromptForHistory(messages);
    if (context && typeof context === "object") {
      const ctxLines = Object.entries(context)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n");
      if (ctxLines) {
        finalSystemPrompt += `\n\nADDITIONAL CONTEXT:\n${ctxLines}`;
      }
    }

    // Normalize roles before sending to the AI provider. The frontend
    // (AtlasPanel.jsx) stores Atlas's own turns with role: "atlas" for
    // UI purposes (avatar/name), but neither Claude nor OpenAI's chat
    // API accepts anything outside "user" / "assistant" / "system" —
    // sending "atlas" through causes a 400 from both providers.
    const ROLE_MAP = { atlas: "assistant", ai: "assistant", bot: "assistant" };
    const normalizedMessages = messages.map((m) => ({
      role: ROLE_MAP[m.role] || m.role,
      content: m.content,
    }));

    const result = await atlasChat({
      systemPrompt: finalSystemPrompt,
      messages: normalizedMessages,
      task: "default",
      maxTokens: 1024,
    });

    if (!result?.text) {
      return res
        .status(500)
        .json({ ok: false, error: "Atlas returned an empty response" });
    }

    return res.json({
      ok: true,
      reply: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    console.error("[Atlas chat] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
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
router.post("/destination-guide", async (req, res) => {
  try {
    const { destination } = req.body ?? {};
    const userId = req.user?.id; // assumes auth middleware sets req.user upstream

    if (!destination || typeof destination !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "destination is required" });
    }

    // Log the view immediately — even if generation fails downstream,
    // this signal still matters for dormancy/email triggers later
    if (userId) await logEvent(userId, "destination_viewed", { destination });

    const systemPrompt = `You are Atlas, Skyrio's AI travel guide.
Given a destination, return a concise, practical guide.

Rules:
- "bestTime" is a short phrase e.g. "Apr-Jun and Sep-Oct".
- "activities" is an array of 3-4 short strings, each a specific must-do (not generic).
- "localTip" is 1 sentence of genuinely useful, non-obvious advice.
- "foodPick" is 1 specific dish or restaurant-type recommendation.
- "summary" is 1-2 sentences capturing the vibe. Max 30 words.
- Be specific and warm, never generic filler.

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

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Destination: ${destination}` },
          ],
        }),
      }
    );

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

    if (userId) await logEvent(userId, "guide_generated", { destination });

    return res.json({ ok: true, guide });
  } catch (err) {
    console.error("[Atlas destination-guide] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
