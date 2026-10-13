import crypto from "crypto";
import { awardXP } from "../services/xpService.js";
import { XP_MAX_SINGLE_AWARD } from "../config/xpRules.js";

// Total XP per user per day that old addXP() callers can grant before being refused.
const LEGACY_DAILY_CAP = 200;

/**
 * 🔼 Add XP to a user — LEGACY SHIM.
 *
 * Old callers keep working, but every grant now:
 *   • goes through the XP ledger (audit trail, atomic, no lost updates),
 *   • rejects negative / NaN / zero amounts and clamps huge ones,
 *   • is capped at LEGACY_DAILY_CAP per user per day,
 *   • logs a warning naming the caller so you can migrate it.
 *
 * Migrate a caller by passing a rule and a source, which makes it dedupe-safe:
 *   addXP(userId, 0, { ruleKey: "POST_CREATED", sourceId: post._id })
 * …or better, call the matching helper in services/xpService.js directly.
 * Bookings must NOT use this — use awardBookingXp() from the Stripe webhook.
 *
 * @param {String} userId - MongoDB user _id
 * @param {Number} amount - XP amount to add (ignored when opts.ruleKey is given)
 * @param {Object} [opts] - { ruleKey, sourceId }
 * @returns {Boolean} true if XP was added, false otherwise
 */
async function addXP(userId, amount, opts = {}) {
  if (!userId) return false;

  try {
    if (opts.ruleKey) {
      const result = await awardXP({
        userId,
        ruleKey: opts.ruleKey,
        sourceId: opts.sourceId,
      });
      return Boolean(result.awarded);
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)
      return false;

    const caller = new Error().stack?.split("\n")[2]?.trim() ?? "unknown";
    console.warn(
      `[xp] legacy addXP(${amount}) ${caller} — migrate this call to services/xpService.js`
    );

    const base = Math.min(Math.round(amount), XP_MAX_SINGLE_AWARD);
    const day = new Date().toISOString().slice(0, 10);
    const result = await awardXP({
      userId,
      ruleKey: "LEGACY_ADD",
      sourceId: opts.sourceId ?? crypto.randomUUID(),
      linkedTo: null,
      baseOverride: base,
      skipMultiplier: true, // the old addXP never applied the plan multiplier
      extraCaps: [[`legacy:${day}`, base, LEGACY_DAILY_CAP]],
    });
    return Boolean(result.awarded);
  } catch (err) {
    console.error("❌ Error adding XP:", err.message);
    return false;
  }
}

export default addXP;
