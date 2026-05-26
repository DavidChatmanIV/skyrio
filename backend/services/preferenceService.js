/**
 * preferenceService.js
 * ─────────────────────────────────────────────────────────────
 * Atlas Memory Engine — extracts user preferences from chat,
 * stores them in MongoDB, and builds a "memory brief" that
 * gets injected into every Atlas system prompt.
 *
 * Drop into:  backend/services/preferenceService.js
 *
 * How it works:
 *   1. After Atlas replies, the route fires extractPreferences()
 *      in the background (non-blocking — doesn't slow chat).
 *   2. extractPreferences() sends the last few user messages to
 *      a single-turn Atlas call with a special extraction prompt.
 *   3. The AI returns structured JSON of any NEW preferences it
 *      found (seat preference, dietary need, budget range, etc).
 *   4. Those get upserted into the user's MongoDB doc.
 *   5. On the NEXT chat call, getMemoryBrief() pulls the stored
 *      profile summary and injects it into the system prompt.
 *   6. Atlas now "remembers" across sessions.
 * ─────────────────────────────────────────────────────────────
 */

import UserPreference from "../models/UserPreference.js";
import { atlasQuery } from "./atlasService.js";

// ─────────────────────────────────────────────────────────────
// EXTRACTION PROMPT
// ─────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a preference extraction engine for a travel planning AI called Atlas.

Given a batch of user messages from a travel planning conversation, extract any NEW personal preferences, travel habits, or constraints the user has revealed.

Return ONLY valid JSON — no markdown, no backticks, no preamble.
If nothing new is found, return {"preferences":[]}.

Schema:
{
  "preferences": [
    {
      "key": "short_snake_case_identifier",
      "value": "what the user prefers (natural language)",
      "category": "travel_style|accommodation|flights|food|activities|budget|destinations|logistics|general",
      "confidence": 0.0-1.0,
      "extractedFrom": "the exact user message that revealed this"
    }
  ]
}

Rules:
- Only extract CLEAR preferences, not vague statements
- "I love window seats" → confidence 0.95
- "Maybe I'll try business class" → confidence 0.4 (too vague, SKIP)
- Minimum confidence threshold: 0.6
- Don't extract trip-specific facts (dates, specific flight numbers) — only REUSABLE preferences
- If the user corrects a previous preference, include the new one with high confidence
- Deduplicate: if two messages say the same thing, extract once
- Maximum 8 preferences per extraction batch
- Categories must match exactly one of the enum values above`;

// ─────────────────────────────────────────────────────────────
// EXTRACT PREFERENCES FROM CONVERSATION
// Called AFTER each Atlas chat response (fire-and-forget).
// ─────────────────────────────────────────────────────────────

export async function extractPreferences(userId, messages = []) {
  try {
    // Only look at user messages (Atlas responses are noise here)
    const userMessages = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(-10); // Last 10 max to keep prompt lean

    if (userMessages.length === 0) return [];

    const extractionPrompt = `Extract travel preferences from these user messages:\n\n${userMessages
      .map((m, i) => `[${i + 1}] ${m}`)
      .join("\n")}`;

    const raw = await atlasQuery(extractionPrompt, {
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      maxTokens: 800,
    });

    // Parse JSON — strip any accidental markdown fencing
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.preferences || !Array.isArray(parsed.preferences)) return [];

    // Filter by confidence threshold
    const valid = parsed.preferences.filter(
      (p) => p.key && p.value && p.category && (p.confidence ?? 0.8) >= 0.6
    );

    if (valid.length === 0) return [];

    // Store in MongoDB
    await storePreferences(userId, valid);

    console.log(
      `[preferenceService] Extracted ${valid.length} preference(s) for user ${userId}`
    );
    return valid;
  } catch (err) {
    // Extraction is best-effort — NEVER block the main chat flow
    console.error("[preferenceService] Extraction error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// STORE PREFERENCES IN MONGODB
// ─────────────────────────────────────────────────────────────

async function storePreferences(userId, preferences) {
  let userPref = await UserPreference.findOne({ userId });

  if (!userPref) {
    userPref = new UserPreference({ userId, preferences: [] });
  }

  for (const pref of preferences) {
    userPref.upsertPreference({
      key: pref.key,
      value: pref.value,
      category: pref.category,
      confidence: pref.confidence ?? 0.8,
      source: "conversation",
      extractedFrom: pref.extractedFrom || "",
    });
  }

  // Update interaction stats
  userPref.stats.lastSeen = new Date();
  userPref.stats.totalConversations += 1;

  // Regenerate the profile summary
  userPref.profileSummary = buildProfileSummary(userPref);

  await userPref.save();
}

// ─────────────────────────────────────────────────────────────
// BUILD PROFILE SUMMARY
// Concise text block injected into every Atlas system prompt.
// ─────────────────────────────────────────────────────────────

function buildProfileSummary(userPref) {
  if (!userPref.preferences || userPref.preferences.length === 0) {
    return "";
  }

  const grouped = {};
  for (const p of userPref.preferences) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p.value);
  }

  const categoryLabels = {
    travel_style: "Travel style",
    accommodation: "Accommodation",
    flights: "Flight preferences",
    food: "Food & dining",
    activities: "Activities & interests",
    budget: "Budget approach",
    destinations: "Destinations",
    logistics: "Logistics",
    general: "Other notes",
  };

  const lines = [];
  for (const [cat, items] of Object.entries(grouped)) {
    const label = categoryLabels[cat] || cat;
    lines.push(`${label}: ${items.join("; ")}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// GET MEMORY BRIEF
// Called by atlas.routes.js BEFORE every chat call.
// Returns the profile summary + metadata.
// ─────────────────────────────────────────────────────────────

export async function getMemoryBrief(userId) {
  try {
    const userPref = await UserPreference.findOne({ userId });
    if (!userPref || !userPref.profileSummary) {
      return { summary: "", preferenceCount: 0, isNewUser: true };
    }

    return {
      summary: userPref.profileSummary,
      preferenceCount: userPref.preferences.length,
      isNewUser: false,
      totalConversations: userPref.stats.totalConversations,
      topDestinations: userPref.stats.topDestinations || [],
    };
  } catch (err) {
    console.error("[preferenceService] getMemoryBrief error:", err.message);
    return { summary: "", preferenceCount: 0, isNewUser: true };
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC CRUD — for settings page / user control
// ─────────────────────────────────────────────────────────────

/** Get all preferences (settings page) */
export async function getUserPreferences(userId) {
  const userPref = await UserPreference.findOne({ userId });
  if (!userPref) return { preferences: [], tripHistory: [], stats: {} };

  return {
    preferences: userPref.preferences,
    tripHistory: userPref.tripHistory,
    stats: userPref.stats,
    profileSummary: userPref.profileSummary,
  };
}

/** Delete a single preference by its _id */
export async function deletePreference(userId, preferenceId) {
  const userPref = await UserPreference.findOne({ userId });
  if (!userPref) return false;

  userPref.preferences = userPref.preferences.filter(
    (p) => p._id.toString() !== preferenceId
  );
  userPref.profileSummary = buildProfileSummary(userPref);
  await userPref.save();
  return true;
}

/** Nuke all preferences (user wants a clean slate) */
export async function clearAllPreferences(userId) {
  const userPref = await UserPreference.findOne({ userId });
  if (!userPref) return false;

  userPref.preferences = [];
  userPref.profileSummary = "";
  await userPref.save();
  return true;
}

/** Add a completed trip to history */
export async function addTripToHistory(userId, tripData) {
  let userPref = await UserPreference.findOne({ userId });
  if (!userPref) {
    userPref = new UserPreference({ userId });
  }

  userPref.tripHistory.push(tripData);

  // Recompute top destinations
  const destCounts = {};
  for (const trip of userPref.tripHistory) {
    if (trip.destination) {
      destCounts[trip.destination] = (destCounts[trip.destination] || 0) + 1;
    }
  }
  userPref.stats.topDestinations = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dest]) => dest);

  // Recompute average budget
  const budgets = userPref.tripHistory
    .filter((t) => t.budget)
    .map((t) => t.budget);
  if (budgets.length > 0) {
    userPref.stats.averageBudget = Math.round(
      budgets.reduce((a, b) => a + b, 0) / budgets.length
    );
  }

  await userPref.save();
  return true;
}

/** Increment message count (called per chat message) */
export async function incrementMessageCount(userId) {
  await UserPreference.findOneAndUpdate(
    { userId },
    {
      $inc: { "stats.totalMessages": 1 },
      $set: { "stats.lastSeen": new Date() },
    },
    { upsert: true }
  );
}
