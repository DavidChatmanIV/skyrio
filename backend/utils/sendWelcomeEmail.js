// backend/utils/sendWelcomeEmail.js
// Welcome email for new signups, on the shared Skyrio email layout.
// Same export and inputs as before, so auth.routes.js is unchanged.
// Never throws: a failed welcome email must never break registration.

import {
  renderEmail,
  sendEmail,
  detailBox,
  bigLine,
  subLine,
  esc,
  APP_URL,
  SUPPORT_EMAIL,
} from "../services/emailLayout.js";

const feature = (icon, title, body) =>
  detailBox("", bigLine(`${icon} ${title}`) + subLine(body));

export async function sendWelcomeEmail({ name, email }) {
  const firstName =
    String(name || "")
      .trim()
      .split(/\s+/)[0] || "";

  const html = renderEmail({
    preheader: "Your Skyrio account is ready — here's what you can do",
    title: `Welcome to Skyrio${firstName ? `, ${esc(firstName)}` : ""}! 🌍`,
    introHtml: "Your account is ready. Here's what you can do:",
    bodyHtml:
      feature(
        "✈️",
        "Book flights &amp; hotels",
        "Search real fares and stays, pick your seats, and get your confirmation in seconds."
      ) +
      feature(
        "🤖",
        "Plan with Atlas AI",
        "Tell Atlas your trip idea and budget, and it helps you find flights and hotels that fit."
      ) +
      feature(
        "👥",
        "Travel together",
        "Plan a group trip with Sync Together and split the cost with everyone going."
      ) +
      feature(
        "🏅",
        "Earn XP on your Passport",
        "Every trip you book earns XP, badges and rewards."
      ),
    cta: { label: "Start planning", url: `${APP_URL}/booking` },
  });

  const text = `Welcome to Skyrio${firstName ? `, ${firstName}` : ""}!

Your account is ready. Here's what you can do:
- Book flights & hotels: search real fares and stays, pick your seats, and get your confirmation in seconds.
- Plan with Atlas AI: tell Atlas your trip idea and budget.
- Travel together: plan a group trip with Sync Together and split the cost.
- Earn XP on your Passport with every trip you book.

Start planning: ${APP_URL}/booking

Questions? ${SUPPORT_EMAIL}
Sent by Skyrio - Plan smarter. Travel better.`;

  return sendEmail({
    to: email,
    subject: `Welcome to Skyrio${firstName ? `, ${firstName}` : ""}! ✈️`,
    html,
    text,
    tag: "welcome",
  });
}
