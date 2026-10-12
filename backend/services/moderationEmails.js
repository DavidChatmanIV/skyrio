// backend/services/moderationEmails.js
// SkyHub moderation emails — the admin alert when something is reported,
// the notice a traveler gets with a strike, and the appeal decision.

import {
  renderEmail,
  sendEmail,
  detailBox,
  bigLine,
  subLine,
  kvRow,
  noteLine,
  esc,
  APP_URL,
  SUPPORT_EMAIL,
} from "./emailLayout.js";

export const GUIDELINES_URL = `${APP_URL}/skyhub/guidelines`;
export const STANDING_URL = `${APP_URL}/skyhub?standing=1`;
const ADMIN_URL = `${APP_URL}/admin/skyhub`;
const ALERT_TO = () => process.env.MODERATION_ALERT_EMAIL || SUPPORT_EMAIL;

export const REASON_LABEL = {
  spam: "Spam or ads",
  scam: "Scams or fraud",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  nudity: "Nudity or sexual content",
  violence: "Violence or threats",
  misinformation: "False or misleading information",
  other: "Breaking the community guidelines",
};

const clip = (s, n = 280) => {
  const t = String(s || "").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// ── To the Skyrio team: something was reported ──
export function sendReportAlert({ targetType, reason, count, autoHidden, snippet, authorName, authorUsername }) {
  const what = targetType === "post" ? "post" : targetType === "comment" ? "comment" : "traveler";
  return sendEmail({
    to: ALERT_TO(),
    tag: "skyhub-report-alert",
    subject: autoHidden
      ? `SkyHub: a ${what} was auto-hidden after ${count} reports`
      : `SkyHub: new report — ${REASON_LABEL[reason] || reason}`,
    html: renderEmail({
      preheader: `${count} report${count === 1 ? "" : "s"} on a ${what}${authorUsername ? ` by @${authorUsername}` : ""}`,
      title: autoHidden ? "Hidden until you review it" : "New SkyHub report",
      introHtml: autoHidden
        ? `This ${what} reached ${count} reports from different travelers, so it's hidden from the feed until you decide.`
        : `A traveler reported a ${what} for <strong>${esc(REASON_LABEL[reason] || reason)}</strong>.`,
      bodyHtml: detailBox(
        what.toUpperCase(),
        (authorName ? bigLine(`${esc(authorName)}${authorUsername ? ` @${esc(authorUsername)}` : ""}`) : "") +
          (snippet ? subLine(`“${esc(clip(snippet))}”`) : "") +
          `<div style="height:10px;line-height:10px;">&nbsp;</div>` +
          kvRow("Reports so far", String(count))
      ),
      cta: { label: "Review in admin", url: ADMIN_URL },
    }),
  });
}

// ── To the traveler: you received a strike ──
export function sendStrikeNotice({ to, name, reason, severity, action, suspensionDays, until, strikeNumber, note, snippet, expiresAt }) {
  const consequence =
    action === "ban"
      ? "Your SkyHub account has been permanently suspended. You can still search and book trips on Skyrio."
      : action === "suspension"
      ? `You can't post, comment or react on SkyHub for ${suspensionDays} day${suspensionDays === 1 ? "" : "s"}${
          until ? ` (until ${new Date(until).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })})` : ""
        }. You can still search and book trips.`
      : "This is a warning — nothing else changes on your account for now.";
  const title = action === "ban" ? "Your SkyHub account is suspended" : action === "suspension" ? "Your SkyHub account is paused" : "A warning about your SkyHub activity";
  return sendEmail({
    to,
    tag: "skyhub-strike",
    subject: title,
    html: renderEmail({
      preheader: `${REASON_LABEL[reason] || "Community guidelines"} — strike ${strikeNumber}`,
      title,
      introHtml: `Hi ${esc(name || "there")}, we removed something you shared on SkyHub because it broke our community guidelines: <strong>${esc(REASON_LABEL[reason] || reason)}</strong>${severity === "severe" ? " (a serious violation)" : ""}.`,
      bodyHtml:
        (snippet ? detailBox("WHAT WAS REMOVED", subLine(`“${esc(clip(snippet))}”`)) : "") +
        detailBox(
          "WHAT HAPPENS NOW",
          subLine(esc(consequence)) +
            (note ? noteLine(`Note from the Skyrio team: ${esc(note)}`) : "") +
            `<div style="height:10px;line-height:10px;">&nbsp;</div>` +
            kvRow("Active strikes", String(strikeNumber)) +
            (expiresAt && action !== "ban"
              ? kvRow("This strike expires", esc(new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })))
              : "") +
            noteLine("More strikes lead to longer pauses, and eventually a permanent suspension from SkyHub.")
        ),
      cta: { label: "See my account standing", url: STANDING_URL },
      footerNote: `Think we got it wrong? You can appeal once from your account standing page. Read the <a href="${GUIDELINES_URL}" style="color:#d9620f;">community guidelines</a>.`,
    }),
  });
}

// ── To the traveler: appeal decision ──
export function sendAppealDecision({ to, name, approved, response }) {
  return sendEmail({
    to,
    tag: "skyhub-appeal",
    subject: approved ? "Your SkyHub appeal was approved" : "Your SkyHub appeal was reviewed",
    html: renderEmail({
      preheader: approved ? "We removed the strike from your account." : "The strike stays on your account.",
      title: approved ? "Appeal approved ✅" : "Appeal reviewed",
      introHtml: approved
        ? `Hi ${esc(name || "there")}, we looked again and removed the strike. Any pause it caused has been lifted.`
        : `Hi ${esc(name || "there")}, we looked at your appeal carefully. The strike stays on your account.`,
      bodyHtml: response ? detailBox("FROM THE SKYRIO TEAM", subLine(esc(response))) : "",
      cta: { label: "See my account standing", url: STANDING_URL },
      footerNote: `Questions? Email ${SUPPORT_EMAIL}.`,
    }),
  });
}
