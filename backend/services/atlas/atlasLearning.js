// backend/services/atlas/atlasLearning.js
// How Atlas learns and adapts per user. No model retraining: Atlas reads a short
// "what I know about you" summary each chat, and search results get ranked by it.
import crypto from "crypto";
import AtlasLearnedPreference, { LEARNING_CATEGORIES } from "../../models/AtlasLearnedPreference.js";
import User from "../../models/user.js";

const CONTEXT_MIN_CONFIDENCE = 0.6; // only fairly sure things go into Atlas's prompt
const RANK_MIN_CONFIDENCE = 0.5;
const MAX_CONTEXT_ITEMS = 15;

// Atlas never learns health or other sensitive details, even if the user says them
const SENSITIVE = /\b(allerg|diabet|pregnan|disab|wheelchair|medic|medication|anxiety|depress|therap|diagnos|illness|cancer|religio|church|mosque|synagogue|pray|politic|democrat|republican|gay|lesbian|trans\b|immigra|visa status|arrest|criminal|income|salary|debt)/i;

export async function isLearningEnabled(userId) {
  const u = await User.findById(userId, { atlasLearningEnabled: 1 }).lean();
  return u?.atlasLearningEnabled !== false; // on by default, user can turn off
}

// ───────────────────── Core upsert ─────────────────────

async function upsert(userId, { key, category, text, source, confidence, data = {}, evidenceInc = 1 }) {
  const existing = await AtlasLearnedPreference.findOne({ user: userId, key });

  if (existing?.editedByUser) {
    // Keep the user's own wording; still track that the pattern held up
    existing.evidenceCount += evidenceInc;
    existing.lastSeenAt = new Date();
    existing.data = { ...existing.data, ...data };
    return existing.save();
  }

  return AtlasLearnedPreference.findOneAndUpdate(
    { user: userId, key },
    {
      $set: { category, text, source, confidence, data, lastSeenAt: new Date() },
      $inc: { evidenceCount: evidenceInc },
      $setOnInsert: { active: true },
    },
    { upsert: true, new: true }
  );
}

// Patterns need repeat evidence. One odd booking shouldn't flip a habit.
function patternConfidence(hits, total) {
  if (total < 2) return 0.3;
  const ratio = hits / total;
  const volume = Math.min(1, total / 4); // reaches full weight after ~4 trips
  return Math.round(ratio * volume * 100) / 100;
}

async function bumpCounter(userId, key, field) {
  const doc = await AtlasLearnedPreference.findOne({ user: userId, key }).lean();
  const counts = { ...(doc?.data?.counts || {}) };
  counts[field] = (counts[field] || 0) + 1;
  counts._total = (counts._total || 0) + 1;
  return counts;
}

// ───────────────────── 1) Learn from what the user says ─────────────────────

export async function rememberStated(userId, { category, text }) {
  if (!(await isLearningEnabled(userId))) return { skipped: "Learning is turned off for this user" };
  if (!LEARNING_CATEGORIES.includes(category)) return { error: "Unknown category" };
  const clean = String(text || "").trim().slice(0, 200);
  if (!clean) return { error: "Nothing to remember" };
  if (SENSITIVE.test(clean)) return { skipped: "Atlas doesn't save health or other personal details like this." };

  const hash = crypto.createHash("sha1").update(`${category}:${clean.toLowerCase()}`).digest("hex").slice(0, 12);
  await upsert(userId, {
    key: `stated.${hash}`,
    category,
    text: clean,
    source: "stated",
    confidence: 0.9,
  });
  return { saved: clean };
}

export async function forgetStated(userId, textMatch) {
  const rows = await AtlasLearnedPreference.find({ user: userId, active: true }).lean();
  const needle = String(textMatch || "").toLowerCase();
  const hit = rows.find((r) => r.text.toLowerCase().includes(needle));
  if (!hit) return { error: "Couldn't find that" };
  await AtlasLearnedPreference.deleteOne({ _id: hit._id });
  return { forgot: hit.text };
}

// ───────────────────── 2) Learn from bookings ─────────────────────
// Call after any completed booking (Atlas or manual checkout) with a normalized summary:
// { kind: "flight"|"hotel"|"excursion",
//   flight?: { airlineCode, airlineName, stops, departHour, cabin, price },
//   hotel?:  { nightly, starRating, amenities: [] },
//   party?:  { adults, children } }

//   groupTrip?: true for Sync Together, followedGroup?: true when they matched friends' flight/room
export async function learnFromBooking(userId, b) {
  if (!(await isLearningEnabled(userId))) return;

  // Matching the group's flight or sharing their room says nothing about personal taste,
  // so only the "who they travel with" pattern is learned from those bookings.
  if (b.followedGroup) {
    await learnParty(userId, b);
    return;
  }

  if (b.kind === "flight" && b.flight) {
    const f = b.flight;

    // Nonstop habit
    {
      const counts = await bumpCounter(userId, "flight.nonstop", f.stops === 0 ? "nonstop" : "connecting");
      const conf = patternConfidence(counts.nonstop || 0, counts._total);
      await upsert(userId, {
        key: "flight.nonstop",
        category: "flights",
        text: "Prefers nonstop flights",
        source: "bookings",
        confidence: conf,
        data: { counts },
        evidenceInc: 0,
      });
    }

    // Time of day
    {
      const bucket = f.departHour < 12 ? "morning" : f.departHour < 17 ? "afternoon" : "evening";
      const counts = await bumpCounter(userId, "flight.time", bucket);
      const [top, hits] = Object.entries(counts)
        .filter(([k]) => k !== "_total")
        .sort((a, b) => b[1] - a[1])[0];
      await upsert(userId, {
        key: "flight.time",
        category: "flights",
        text: `Usually flies in the ${top}`,
        source: "bookings",
        confidence: patternConfidence(hits, counts._total),
        data: { counts, top },
        evidenceInc: 0,
      });
    }

    // Favorite airline
    if (f.airlineCode) {
      const counts = await bumpCounter(userId, "flight.airline", f.airlineCode);
      const [top, hits] = Object.entries(counts)
        .filter(([k]) => k !== "_total")
        .sort((a, b) => b[1] - a[1])[0];
      const names = { ...(await AtlasLearnedPreference.findOne({ user: userId, key: "flight.airline" }).lean())?.data?.names, [f.airlineCode]: f.airlineName };
      await upsert(userId, {
        key: "flight.airline",
        category: "flights",
        text: `Often books ${names[top] || top}`,
        source: "bookings",
        confidence: patternConfidence(hits, counts._total),
        data: { counts, top, names },
        evidenceInc: 0,
      });
    }

    if (typeof f.price === "number") await learnRange(userId, "budget.flight", "budget", "flight", f.price, "per ticket");
  }

  if (b.kind === "hotel" && b.hotel) {
    const h = b.hotel;
    if (typeof h.nightly === "number") await learnRange(userId, "budget.hotel", "budget", "hotel", h.nightly, "per night");
    if (h.starRating) {
      const counts = await bumpCounter(userId, "hotel.stars", String(Math.round(h.starRating)));
      const [top, hits] = Object.entries(counts)
        .filter(([k]) => k !== "_total")
        .sort((a, b) => b[1] - a[1])[0];
      await upsert(userId, {
        key: "hotel.stars",
        category: "hotels",
        text: `Usually picks ${top}-star hotels`,
        source: "bookings",
        confidence: patternConfidence(hits, counts._total),
        data: { counts, top: Number(top) },
        evidenceInc: 0,
      });
    }
  }

  await learnParty(userId, b);
}

async function learnParty(userId, b) {
  if (b.party || b.groupTrip) {
    const p = b.party || { adults: 1, children: 0 };
    // In Sync Together you book only your own share, but you're still traveling with a group
    const type = b.groupTrip
      ? "with a group"
      : p.children > 0 ? "with kids" : p.adults > 2 ? "with a group" : p.adults === 2 ? "as a pair" : "solo";
    const counts = await bumpCounter(userId, "party.type", type);
    const [top, hits] = Object.entries(counts)
      .filter(([k]) => k !== "_total")
      .sort((a, b) => b[1] - a[1])[0];
    await upsert(userId, {
      key: "party.type",
      category: "travel_party",
      text: `Usually travels ${top}`,
      source: "bookings",
      confidence: patternConfidence(hits, counts._total),
      data: { counts, top },
      evidenceInc: 0,
    });
  }
}

// Keeps the last 10 amounts and describes the usual range in plain words
async function learnRange(userId, key, category, label, amount, unit) {
  const doc = await AtlasLearnedPreference.findOne({ user: userId, key }).lean();
  const recent = [...(doc?.data?.recent || []), amount].slice(-10).sort((a, b) => a - b);
  const lo = recent[Math.floor(recent.length * 0.2)];
  const hi = recent[Math.ceil(recent.length * 0.8) - 1];
  const round = (n) => Math.round(n / 10) * 10;
  await upsert(userId, {
    key,
    category,
    text: lo === hi ? `Usually spends about $${round(lo)} ${unit} on ${label}s` : `Usually spends $${round(lo)}–$${round(hi)} ${unit} on ${label}s`,
    source: "bookings",
    confidence: patternConfidence(recent.length, Math.max(recent.length, 2)),
    data: { recent, lo, hi },
    evidenceInc: 1,
  });
}

// ───────────────────── 3) Learn from which option they pick ─────────────────────
// shown: features of every option Atlas showed; picked: the one they chose

export async function learnFromChoice(userId, kind, shown, picked) {
  if (!(await isLearningEnabled(userId)) || !picked || shown.length < 2) return;

  if (kind === "flight") {
    // Did they skip a cheaper option to get nonstop? That's a strong signal.
    const cheaperConnecting = shown.some((o) => o.stops > 0 && o.price < picked.price);
    if (picked.stops === 0 && cheaperConnecting) {
      const doc = await AtlasLearnedPreference.findOne({ user: userId, key: "choice.pays_for_nonstop" }).lean();
      const n = (doc?.data?.n || 0) + 1;
      await upsert(userId, {
        key: "choice.pays_for_nonstop",
        category: "flights",
        text: "Will pay more to fly nonstop",
        source: "choices",
        confidence: Math.min(0.9, 0.4 + n * 0.15),
        data: { n },
        evidenceInc: 1,
      });
    }

    // Always picks the cheapest?
    const cheapest = Math.min(...shown.map((o) => o.price));
    const doc = await AtlasLearnedPreference.findOne({ user: userId, key: "choice.cheapest" }).lean();
    const c = { picked: (doc?.data?.picked || 0) + (picked.price === cheapest ? 1 : 0), total: (doc?.data?.total || 0) + 1 };
    await upsert(userId, {
      key: "choice.cheapest",
      category: "budget",
      text: "Usually goes with the cheapest option",
      source: "choices",
      confidence: patternConfidence(c.picked, c.total),
      data: c,
      evidenceInc: 0,
    });
  }
}

// ───────────────────── 4) Learn from feedback reasons ─────────────────────

const STYLE_FROM_REASON = {
  too_long: { key: "style.short", text: "Prefers short, quick replies" },
  too_many_questions: { key: "style.fewer_questions", text: "Prefers fewer questions; make sensible guesses and confirm" },
};

export async function learnFromFeedback(userId, reasons = []) {
  if (!(await isLearningEnabled(userId))) return;
  for (const r of reasons) {
    const style = STYLE_FROM_REASON[r];
    if (!style) continue;
    const doc = await AtlasLearnedPreference.findOne({ user: userId, key: style.key }).lean();
    const n = (doc?.data?.n || 0) + 1;
    await upsert(userId, {
      key: style.key,
      category: "communication",
      text: style.text,
      source: "feedback",
      confidence: Math.min(0.95, 0.35 + n * 0.25), // 2 of the same reason is enough to adapt
      data: { n },
      evidenceInc: 1,
    });
  }
}

// ───────────────────── Using what Atlas learned ─────────────────────

// Short block added to Atlas's system prompt each chat
export async function buildLearnedContext(userId) {
  if (!(await isLearningEnabled(userId))) return "";
  const rows = await AtlasLearnedPreference.find({
    user: userId,
    active: true,
    confidence: { $gte: CONTEXT_MIN_CONFIDENCE },
  })
    .sort({ confidence: -1, lastSeenAt: -1 })
    .limit(MAX_CONTEXT_ITEMS)
    .lean();
  if (!rows.length) return "";

  const lines = rows.map((r) => `- ${r.text} (${r.source === "stated" ? "they told you" : "learned from their " + r.source})`);
  return `
What you've learned about this traveler (use it to suggest and rank, but always let them choose; never mention a confidence score):
${lines.join("\n")}
If something here seems wrong for this trip, just ask. If they correct you, call remember_preference or forget_preference.`;
}

// Re-orders search results by what this user tends to pick. Returns options with a "whyForYou" tag.
export async function rankForUser(userId, kind, options) {
  if (!(await isLearningEnabled(userId)) || options.length < 2) return options;
  const prefs = await AtlasLearnedPreference.find({
    user: userId,
    active: true,
    confidence: { $gte: RANK_MIN_CONFIDENCE },
  }).lean();
  if (!prefs.length) return options;
  const by = Object.fromEntries(prefs.map((p) => [p.key, p]));

  const scored = options.map((o, i) => {
    let score = -i * 0.05; // keep provider order as a tiebreaker
    const why = [];

    if (kind === "flight") {
      const nonstopPref = by["flight.nonstop"] || by["choice.pays_for_nonstop"];
      if (nonstopPref && o.stops === 0) {
        score += nonstopPref.confidence;
        why.push("nonstop");
      }
      const time = by["flight.time"];
      if (time) {
        const h = new Date(o.depart).getHours();
        const bucket = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
        if (bucket === time.data.top) {
          score += time.confidence * 0.6;
          why.push(`${bucket} departure`);
        }
      }
      const airline = by["flight.airline"];
      if (airline && o.airlineCode === airline.data.top) {
        score += airline.confidence * 0.5;
        why.push(`${o.airline}`);
      }
      const budget = by["budget.flight"];
      if (budget && o.price <= budget.data.hi * 1.1) score += budget.confidence * 0.4;
      const cheap = by["choice.cheapest"];
      if (cheap) score -= (o.price / Math.max(...options.map((x) => x.price))) * cheap.confidence;
    }

    if (kind === "hotel") {
      const budget = by["budget.hotel"];
      if (budget && o.nightly >= budget.data.lo * 0.8 && o.nightly <= budget.data.hi * 1.15) {
        score += budget.confidence;
        why.push("in your usual price range");
      }
      const stars = by["hotel.stars"];
      if (stars && Math.round(o.starRating || 0) === stars.data.top) {
        score += stars.confidence * 0.6;
        why.push(`${stars.data.top}-star`);
      }
    }

    return { o, score, why };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ o, why }) => (why.length ? { ...o, whyForYou: `Matches your usual: ${why.join(", ")}` } : o));
}
