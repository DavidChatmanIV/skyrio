/**
 * dormancyEmail.job.js — backend/jobs/dormancyEmail.job.js
 *
 * Runs once daily. Finds users with no activity in the last N days
 * who haven't already been sent a dormancy nudge recently, and emails
 * them a lightweight re-engagement message (destination-guide flavored,
 * not a hard sell).
 */

import User from "../models/user.js";
import Event from "../models/event.js";
import { sendEmail } from "../services/emailService.js";
import { logEvent } from "../services/eventService.js";

const DORMANCY_THRESHOLD_DAYS = 45;
const RESEND_COOLDOWN_DAYS = 30; // don't nudge the same user more than once/month

export async function runDormancyEmailJob() {
  console.log("[dormancyJob] starting run:", new Date().toISOString());

  const dormancyCutoff = new Date(
    Date.now() - DORMANCY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  );
  const cooldownCutoff = new Date(
    Date.now() - RESEND_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );

  // Users who HAVE had recent activity — exclude these
  const activeUserIds = await Event.distinct("userId", {
    timestamp: { $gte: dormancyCutoff },
  });

  // Users who've already gotten a dormancy email recently — exclude these too
  const recentlyNudgedUserIds = await Event.distinct("userId", {
    eventType: "dormancy_email_sent",
    timestamp: { $gte: cooldownCutoff },
  });

  const excludedIds = [
    ...new Set([...activeUserIds, ...recentlyNudgedUserIds]),
  ];

  const dormantUsers = await User.find({
    _id: { $nin: excludedIds },
    email: { $exists: true, $ne: null },
  }).select("_id email firstName");

  console.log(`[dormancyJob] found ${dormantUsers.length} dormant users`);

  let sent = 0;
  let failed = 0;

  for (const user of dormantUsers) {
    const html = buildDormancyEmailHtml(user.firstName);

    const result = await sendEmail({
      to: user.email,
      subject: "Where's Atlas taking you next?",
      html,
    });

    if (result.ok) {
      sent++;
      await logEvent(user._id, "dormancy_email_sent", {});
    } else {
      failed++;
    }
  }

  console.log(`[dormancyJob] done. sent: ${sent}, failed: ${failed}`);
  return { sent, failed, totalDormant: dormantUsers.length };
}

function buildDormancyEmailHtml(firstName) {
  const name = firstName || "there";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Hey ${name}, thinking about your next trip?</h2>
      <p>
        It's been a while since you've been on Skyrio. Atlas can put together
        a destination guide in seconds — just tell it where you're dreaming of going.
      </p>
      <a href="https://skyrio.com/atlas" 
         style="display:inline-block; padding:12px 24px; background:#000; color:#fff; 
                text-decoration:none; border-radius:6px; margin-top:12px;">
        Ask Atlas
      </a>
    </div>
  `;
}
