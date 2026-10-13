// backend/services/skyhubModeration.js
// ─────────────────────────────────────────────────────────────
// SkyHub strikes — warnings before bans, the way most platforms do it.
//
// Change the rules here (one place): how long strikes last, what each
// strike number leads to, and what a "severe" violation skips to.
// ─────────────────────────────────────────────────────────────

import SkyHubStrike from "../models/SkyHubStrike.js";
import SkyHubRestriction from "../models/SkyHubRestriction.js";
import SkyHubPost from "../models/SkyHubPost.js";
import SkyHubComment from "../models/SkyHubComment.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import {
  sendStrikeNotice,
  sendAppealDecision,
  REASON_LABEL,
} from "./moderationEmails.js";

export const STRIKE_POLICY = {
  // Strikes stop counting after this many days.
  expiresAfterDays: 90,
  // Active strikes (including the new one) → what happens.
  //   days: 0 = warning only; null = permanent SkyHub ban
  ladder: [
    { strikes: 1, days: 0 },
    { strikes: 2, days: 1 },
    { strikes: 3, days: 7 },
    { strikes: 4, days: 30 },
    { strikes: 5, days: null },
  ],
  // Serious violations skip the warning.
  //   active strikes before this one → days
  severe: [
    { prior: 0, days: 7 },
    { prior: 1, days: 30 },
    { prior: 2, days: null },
  ],
  // Reasons the admin page pre-selects as severe (you can still choose).
  severeReasons: ["hate", "violence", "nudity", "scam", "intimate_image"],
  // Travelers can appeal within this many days of a strike.
  appealWindowDays: 30,
};

/* ─────────────────────────────────────────────────────────────
   Report reasons and how urgently each is handled.
     critical → hidden on the FIRST report, top of the admin queue
     priority → reviewed first, hidden at the usual report count
     standard → hidden once AUTO_HIDE_REPORTS different people report it
───────────────────────────────────────────────────────────── */
export const REPORT_REASONS = {
  child_safety: { severity: "critical", label: "Child safety" },
  intimate_image: {
    severity: "critical",
    label: "Intimate image shared without consent",
  },
  violence: { severity: "priority", label: "Violence or threats" },
  self_harm: { severity: "priority", label: "Self-harm or suicide" },
  hate: { severity: "priority", label: "Hate speech" },
  harassment: { severity: "priority", label: "Harassment or bullying" },
  nudity: { severity: "standard", label: "Nudity or sexual content" },
  scam: { severity: "standard", label: "Scam or fraud" },
  spam: { severity: "standard", label: "Spam or ads" },
  misinformation: { severity: "standard", label: "False or misleading info" },
  other: { severity: "standard", label: "Something else" },
};
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS);
export const severityOf = (reason) =>
  REPORT_REASONS[reason]?.severity || "standard";
export const reasonLabel = (reason) => REPORT_REASONS[reason]?.label || reason;
const SEVERITY_RANK = { critical: 0, priority: 1, standard: 2 };
export const severityRank = (s) => SEVERITY_RANK[s] ?? 2;

// Legal clocks (US):
//   • TAKE IT DOWN Act: remove nonconsensual intimate images within 48 hours
//     of a valid request, plus known identical copies.
//   • 18 U.S.C. §2258A as amended by the REPORT Act (2024): keep what you
//     reported to NCMEC for 1 year.
export const LEGAL = {
  intimateImageHours: 48,
  childSafetyHoldDays: 365,
  // DMCA repeat-infringer policy: this many upheld copyright takedowns → ban.
  repeatInfringerLimit: 3,
};

const DAY = 24 * 60 * 60 * 1000;

export async function activeStrikes(userId) {
  return SkyHubStrike.find({
    user: userId,
    voided: { $ne: true },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
}

export function decide(priorCount, severity) {
  if (severity === "severe") {
    const rule =
      [...STRIKE_POLICY.severe].reverse().find((r) => priorCount >= r.prior) ||
      STRIKE_POLICY.severe[0];
    return rule.days;
  }
  const n = priorCount + 1;
  const ladder = STRIKE_POLICY.ladder;
  const rule = [...ladder].reverse().find((r) => n >= r.strikes) || ladder[0];
  return rule.days;
}

// Gives a traveler a strike, applies the pause/ban the ladder calls for,
// and tells them (in-app + email). Returns what happened.
export async function issueStrike({
  userId,
  reason = "other",
  severity = "standard",
  targetType = null,
  targetId = null,
  snippet = "",
  note = "",
  by = "admin",
  forceBan = false,
}) {
  const prior = await activeStrikes(userId);
  const days = forceBan ? null : decide(prior.length, severity);
  const action = days === null ? "ban" : days > 0 ? "suspension" : "warning";
  const now = Date.now();

  const strike = await SkyHubStrike.create({
    user: userId,
    reason,
    severity,
    note: String(note || "").slice(0, 500),
    targetType,
    targetId,
    snippet: String(snippet || "").slice(0, 300),
    action,
    suspensionDays: days || 0,
    strikeNumber: prior.length + 1,
    by,
    expiresAt: new Date(now + STRIKE_POLICY.expiresAfterDays * DAY),
  });

  let until = null;
  if (action !== "warning") {
    until = action === "ban" ? null : new Date(now + days * DAY);
    // Never shorten an existing, longer pause.
    const existing = await SkyHubRestriction.findOne({ user: userId }).lean();
    const keepExisting =
      existing &&
      (existing.permanent ||
        existing.until === null ||
        (until && existing.until && new Date(existing.until) > until));
    if (!keepExisting) {
      await SkyHubRestriction.updateOne(
        { user: userId },
        {
          $set: {
            user: userId,
            until,
            permanent: action === "ban",
            reason: REASON_LABEL[reason] || reason,
            by,
            strike: strike._id,
          },
        },
        { upsert: true }
      );
    } else {
      until = existing.until;
    }
  }

  // Tell them.
  const u = await User.findById(userId).select("name username email").lean();
  const title =
    action === "ban"
      ? "Your SkyHub account is suspended"
      : action === "suspension"
      ? `SkyHub paused for ${days} day${days === 1 ? "" : "s"}`
      : "A warning about your SkyHub activity";
  Notification.create({
    user: userId,
    type: "system",
    title,
    message: `We removed something you shared for ${
      REASON_LABEL[reason] || "breaking the guidelines"
    }. Tap to see your account standing.`,
    link: "/skyhub?standing=1",
  }).catch(() => {});
  if (u?.email) {
    sendStrikeNotice({
      to: u.email,
      name: u.name || u.username,
      reason,
      severity,
      action,
      suspensionDays: days || 0,
      until,
      strikeNumber: prior.length + 1,
      note,
      snippet,
      expiresAt: strike.expiresAt,
    });
  }
  return { strike, action, days, until, strikeNumber: prior.length + 1 };
}

// What a traveler sees about their own account.
export async function standingFor(userId) {
  const [strikes, restriction] = await Promise.all([
    SkyHubStrike.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    SkyHubRestriction.findOne({ user: userId }).lean(),
  ]);
  const now = Date.now();
  const paused =
    restriction &&
    (restriction.permanent ||
      restriction.until === null ||
      new Date(restriction.until).getTime() > now)
      ? {
          until: restriction.until,
          permanent: Boolean(
            restriction.permanent || restriction.until === null
          ),
          reason: restriction.reason,
        }
      : null;
  const list = strikes.map((s) => {
    const active = !s.voided && new Date(s.expiresAt).getTime() > now;
    const canAppeal =
      !s.voided &&
      s.appeal?.status === "none" &&
      now - new Date(s.createdAt).getTime() <
        STRIKE_POLICY.appealWindowDays * DAY;
    return {
      id: String(s._id),
      reason: s.reason,
      reasonLabel: REASON_LABEL[s.reason] || s.reason,
      severity: s.severity,
      action: s.action,
      suspensionDays: s.suspensionDays,
      note: s.note,
      snippet: s.snippet,
      at: s.createdAt,
      expiresAt: s.expiresAt,
      active,
      voided: Boolean(s.voided),
      appeal: {
        status: s.appeal?.status || "none",
        response: s.appeal?.response || "",
      },
      canAppeal,
    };
  });
  return {
    activeStrikes: list.filter((s) => s.active).length,
    paused,
    strikes: list,
    policy: {
      expiresAfterDays: STRIKE_POLICY.expiresAfterDays,
      ladder: STRIKE_POLICY.ladder,
      appealWindowDays: STRIKE_POLICY.appealWindowDays,
    },
  };
}

// Admin decides an appeal. Approving voids the strike, lifts the pause it
// caused, and restores the removed post/comment.
export async function resolveAppeal({
  strikeId,
  approve,
  response = "",
  by = "admin",
}) {
  const strike = await SkyHubStrike.findById(strikeId);
  if (!strike || strike.appeal?.status !== "pending")
    return { ok: false, error: "This appeal isn't waiting for a decision." };
  strike.appeal.status = approve ? "approved" : "denied";
  strike.appeal.response = String(response || "").slice(0, 1000);
  strike.appeal.resolvedBy = by;
  strike.appeal.resolvedAt = new Date();
  if (approve) strike.voided = true;
  await strike.save();

  if (approve) {
    await SkyHubRestriction.deleteOne({
      user: strike.user,
      strike: strike._id,
    });
    if (strike.targetType === "post" && strike.targetId) {
      await SkyHubPost.updateOne(
        { _id: strike.targetId },
        { $set: { hidden: false, hiddenReason: null } }
      );
    } else if (strike.targetType === "comment" && strike.targetId) {
      const c = await SkyHubComment.findOneAndUpdate(
        { _id: strike.targetId },
        { $set: { hidden: false, hiddenReason: null } }
      );
      if (c?.post)
        await SkyHubPost.updateOne(
          { _id: c.post },
          { $inc: { commentsCount: 1 } }
        );
    }
  }

  const u = await User.findById(strike.user)
    .select("name username email")
    .lean();
  Notification.create({
    user: strike.user,
    type: "system",
    title: approve
      ? "Your SkyHub appeal was approved"
      : "Your SkyHub appeal was reviewed",
    message: approve
      ? "We removed the strike from your account."
      : "The strike stays on your account.",
    link: "/skyhub?standing=1",
  }).catch(() => {});
  if (u?.email)
    sendAppealDecision({
      to: u.email,
      name: u.name || u.username,
      approved: approve,
      response,
    });
  return { ok: true };
}
