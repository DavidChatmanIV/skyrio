// backend/services/thankYou.js
// "Thank you for your feedback / review" — sent from the admin dashboard.
// In-app notification and/or email, using the same layout as every
// Skyrio email. The admin writes the middle; greeting and sign-off are
// added here so every message reads the same.
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { renderEmail, sendEmail, noteLine, esc } from "./emailLayout.js";

const APP_URL = (process.env.FRONTEND_URL || "https://myskyrio.com").replace(
  /\/$/,
  ""
);

const firstName = (u) =>
  String(u?.name || u?.username || "")
    .trim()
    .split(/\s+/)[0] || "there";

/**
 * @param {object} p
 * @param {string|object} [p.user] user id or a user document
 * @param {{name?:string,email:string}} [p.guest] someone with no account
 *        (email only: there's no in-app inbox to notify)
 * @param {"feedback"|"review"} p.kind
 * @param {string} p.message        the admin's message (plain text)
 * @param {boolean} [p.notify=true] in-app notification
 * @param {boolean} [p.email=true]  email
 * @returns {Promise<{notified:boolean, emailed:boolean}>}
 */
export async function sendThankYou({
  user,
  guest,
  kind,
  message,
  notify = true,
  email = true,
}) {
  const doc = guest?.email
    ? { _id: null, name: guest.name || "", email: guest.email, isGuest: true }
    : user && typeof user === "object" && user.email
    ? user
    : await User.findById(user?._id || user)
        .select("name username email")
        .lean();
  if (!doc) throw Object.assign(new Error("User not found"), { status: 404 });

  const text = String(message || "")
    .trim()
    .slice(0, 600);
  if (!text)
    throw Object.assign(new Error("Message is empty"), { status: 400 });

  const what = kind === "review" ? "review" : "feedback";
  const name = firstName(doc);
  const result = {
    notified: false,
    emailed: false,
    name: doc.name || doc.username || null,
    to: doc.email || null,
    emailError: null,
  };

  if (notify && !doc.isGuest) {
    try {
      const note = {
        user: doc._id,
        type: "system",
        title: `Thank you for your ${what}`,
        message: `Hi ${name}, ${text} — The Skyrio team`,
        link: kind === "review" ? "/" : "/passport",
      };
      try {
        await Notification.create(note);
      } catch (err) {
        // If the Notification model only allows certain types, fall back
        // to "booking" (a type every Skyrio notification list accepts).
        if (err?.name !== "ValidationError") throw err;
        await Notification.create({ ...note, type: "booking" });
      }
      result.notified = true;
    } catch (err) {
      console.error("[thankYou] notification failed:", err?.message);
    }
  }

  if (email && doc.email) {
    try {
      const sent = await sendEmail({
        to: doc.email,
        tag: `thank-you-${what}`,
        subject: `Thank you for your ${what}, ${name}`,
        html: renderEmail({
          preheader: `A quick thank-you from the Skyrio team.`,
          title: `Thank you, ${esc(name)}!`,
          introHtml: esc(text).replace(/\n/g, "<br>"),
          bodyHtml: noteLine(
            "Got more ideas or spotted something off? Tap Help &amp; Feedback on any page. We read every message. — The Skyrio team"
          ),
          cta: { label: "Back to Skyrio", url: APP_URL },
        }),
      });
      // Some mailers report failure in the return value instead of
      // throwing, so check that too.
      if (
        sent === false ||
        sent?.ok === false ||
        sent?.success === false ||
        sent?.error
      ) {
        throw new Error(
          String(
            sent?.error?.message ||
              sent?.error ||
              sent?.message ||
              "Email provider rejected it"
          )
        );
      }
      result.emailed = true;
    } catch (err) {
      result.emailError = String(err?.message || "Email failed").slice(0, 160);
      console.error("[thankYou] email failed:", doc.email, err?.message);
    }
  }

  return result;
}
