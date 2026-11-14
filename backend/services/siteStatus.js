// Disruption mode: one live travel alert for the whole site.
//
//  - The banner on every page and Atlas both read it, so they say the same thing.
//  - While it's on, it can pause NEW flight / hotel / car bookings. Checkouts
//    already past payment are never blocked, so nobody is charged without a
//    booking.
//  - The admin can email travelers whose trips start soon, once per alert.
//
// Wording rule: say what's happening and what the traveler is owed. Never
// promise outcomes Skyrio doesn't control (whether a flight will leave,
// hotel refunds, airline waivers).

import crypto from "node:crypto";
import SiteStatus, {
  ALERT_KINDS,
  ALERT_SEVERITIES,
} from "../models/SiteStatus.js";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import {
  renderEmail,
  sendEmail,
  detailBox,
  subLine,
  noteLine,
  esc,
  APP_URL,
  TRIPS_URL,
} from "./emailLayout.js";
import { manageUrlFor } from "./manageLink.js";

export const HELP_PATH = "/travel-disruptions";
const VERTICALS = ["flights", "hotels", "cars"];

/* ───────────── read (cached) ───────────── */

let cache = { at: 0, doc: null };
const CACHE_MS = 15_000;

export async function getSiteStatus({ fresh = false } = {}) {
  if (!fresh && cache.doc && Date.now() - cache.at < CACHE_MS) return cache.doc;
  const doc = await SiteStatus.findOne({ key: "current" }).lean();
  cache = { at: Date.now(), doc: doc || null };
  return cache.doc;
}

const bust = () => {
  cache = { at: 0, doc: null };
};

/** What the public site and Atlas see. Nothing private. */
export function publicView(doc) {
  if (!doc?.active) return { active: false };
  return {
    active: true,
    id: doc.version,
    kind: doc.kind,
    severity: doc.severity,
    title: doc.title,
    message: doc.message,
    areas: doc.areas || "",
    affects: {
      flights: Boolean(doc.affects?.flights),
      hotels: Boolean(doc.affects?.hotels),
      cars: Boolean(doc.affects?.cars),
    },
    paused: {
      flights: Boolean(doc.pause?.flights),
      hotels: Boolean(doc.pause?.hotels),
      cars: Boolean(doc.pause?.cars),
    },
    updatedAt: doc.updatedAt,
    helpPath: HELP_PATH,
  };
}

/* ───────────── write (admin) ───────────── */

const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .trim()
    .slice(0, max);

const flags = (obj = {}) =>
  Object.fromEntries(VERTICALS.map((k) => [k, Boolean(obj?.[k])]));

/** Validates admin input. Returns { value } or { error }. */
export function validateAlert(body = {}) {
  const kind = ALERT_KINDS.includes(body.kind) ? body.kind : "other";
  const severity = ALERT_SEVERITIES.includes(body.severity)
    ? body.severity
    : "warning";
  const title = clean(body.title, 80);
  const message = clean(body.message, 300);
  if (title.length < 3) return { error: "Add a short title." };
  if (message.length < 10) return { error: "Add a message travelers can act on." };
  const affects = flags(body.affects);
  const pause = flags(body.pause);
  // Pausing a kind of booking implies it's affected.
  for (const k of VERTICALS) if (pause[k]) affects[k] = true;
  return {
    value: { kind, severity, title, message, areas: clean(body.areas, 120), affects, pause },
  };
}

export async function setSiteStatus(value, by = "admin") {
  const prev = await SiteStatus.findOne({ key: "current" }).lean();
  const isNew = !prev?.active;
  const now = new Date();
  const doc = await SiteStatus.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        ...value,
        active: true,
        updatedBy: by,
        // A new alert gets a new id; editing one keeps it, so travelers
        // already emailed about it aren't emailed again.
        ...(isNew
          ? {
              version: crypto.randomBytes(6).toString("hex"),
              startedAt: now,
              notifiedBookingIds: [],
            }
          : {}),
      },
      $push: {
        history: {
          $each: [{ ...value, active: true, by, at: now }],
          $position: 0,
          $slice: 30,
        },
      },
    },
    { upsert: true, new: true }
  ).lean();
  bust();
  console.log(
    `[site-status] ${isNew ? "posted" : "updated"} by ${by}: ${value.kind} "${value.title}" pause=${JSON.stringify(value.pause)}`
  );
  return doc;
}

/** Turns the alert off. Pauses end with it. */
export async function clearSiteStatus(by = "admin") {
  const doc = await SiteStatus.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        active: false,
        updatedBy: by,
        pause: { flights: false, hotels: false, cars: false },
      },
      $push: {
        history: {
          $each: [{ active: false, by, at: new Date() }],
          $position: 0,
          $slice: 30,
        },
      },
    },
    { new: true }
  ).lean();
  bust();
  console.log(`[site-status] cleared by ${by}`);
  return doc;
}

/* ───────────── booking pause ───────────── */

const LABEL = { flights: "Flight", hotels: "Hotel", cars: "Car rental" };

/**
 * Express middleware for the routes that START a booking (holds, payment
 * intents). Never put it on "complete/confirm" routes: those run after the
 * card is charged or authorized.
 */
export function requireSalesOpen(vertical) {
  return async (req, res, next) => {
    try {
      const s = await getSiteStatus();
      if (s?.active && s.pause?.[vertical]) {
        const msg = `${LABEL[vertical]} booking is paused right now: ${s.title}. You haven't been charged. Try again later.`;
        return res.status(503).json({
          ok: false,
          paused: true,
          vertical,
          error: msg,
          message: msg,
          helpPath: HELP_PATH,
        });
      }
    } catch (err) {
      // If the status can't be read, don't block bookings.
      console.error("[site-status] pause check failed:", err.message);
    }
    next();
  };
}

/* ───────────── Atlas ───────────── */

/** Extra instructions for Atlas while an alert is on ("" when off). */
export async function atlasStatusNote() {
  const s = await getSiteStatus().catch(() => null);
  if (!s?.active) return "";
  const paused = VERTICALS.filter((k) => s.pause?.[k]).map((k) => LABEL[k].toLowerCase());
  return [
    "LIVE TRAVEL ALERT (posted by Skyrio staff; this is current and true):",
    `- ${s.title}: ${s.message}`,
    s.areas ? `- Areas: ${s.areas}` : "",
    paused.length
      ? `- New ${paused.join(", ")} bookings are PAUSED on Skyrio. Searching to plan is fine, but don't start a booking or send a checkout link for them; say booking is paused and to try again later. Existing trips aren't affected.`
      : "",
    "How to talk about it:",
    "- Mention it when the traveler's trip or question could be affected. Keep it to 1-2 sentences.",
    "- Only repeat what the alert says. Don't guess how long it lasts or whether a specific flight will leave.",
    "- For live flight status, tell them to check their airline's app or site; the airline has the latest.",
    "- If the airline cancels or significantly changes a flight to, from or within the US and they choose not to travel, they're owed a full refund. Hotel and car policies still apply.",
    `- Point them to ${APP_URL}${HELP_PATH} for what to do, or Help for a person.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ───────────── emailing travelers ───────────── */

const TYPE_FOR = { flights: ["Flight", "Package"], hotels: ["Hotel", "Package"], cars: ["Car"] };

function tripStart(b) {
  const raw =
    b.dates?.start ||
    b.flight?.departureAt ||
    b.hotelStay?.rooms?.[0]?.checkin ||
    b.carRental?.pickupAt;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const airportList = (s = "") =>
  String(s)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((c) => c.length === 3);

/**
 * Confirmed trips starting between now and `hours` from now (plus trips in
 * progress), of the chosen kinds. `airports` (e.g. "EWR, JFK") narrows
 * flights to those leaving from or arriving at them.
 */
export async function findAffectedBookings({ hours = 48, verticals = ["flights"], airports = "" } = {}) {
  const h = Math.min(Math.max(Number(hours) || 48, 1), 168);
  const types = [...new Set(verticals.flatMap((v) => TYPE_FOR[v] || []))];
  if (!types.length) return [];
  const now = new Date();
  const until = new Date(now.getTime() + h * 3600 * 1000);
  const codes = airportList(airports);

  const rows = await Booking.find({
    status: "confirmed",
    type: { $in: types },
    $or: [
      // Started up to 30 days ago (could still be underway) through the window.
      { "dates.start": { $gte: new Date(now.getTime() - 30 * 864e5), $lte: until } },
      { "dates.start": null }, // older records keep the date elsewhere
    ],
  })
    .select("user name email type tripDetails flight.origin flight.destination flight.departureAt flight.airline dates hotelStay.rooms.checkin hotelStay.hotelName carRental.pickupAt")
    .limit(5000)
    .lean();

  return rows.filter((b) => {
    const start = tripStart(b);
    if (!start) return false;
    const end = b.dates?.end ? new Date(b.dates.end) : start;
    // starts inside the window, or already underway
    const relevant = (start >= now && start <= until) || (start <= now && end >= now);
    if (!relevant) return false;
    if (codes.length && b.type === "Flight") {
      const o = String(b.flight?.origin || "").toUpperCase();
      const d = String(b.flight?.destination || "").toUpperCase();
      return codes.includes(o) || codes.includes(d);
    }
    return true;
  });
}

function alertEmail(s, b, manageUrl) {
  const isFlight = b.type === "Flight" || b.type === "Package";
  const what = isFlight
    ? "Check your airline's app or site for your flight's live status. They have the latest, and they make the call on delays and cancellations."
    : b.type === "Hotel"
    ? "Your room follows the hotel's cancellation policy. If your plans change, check the policy in Trips or contact the hotel."
    : "Your rental follows the rental company's policy. Contact them if your pickup time changes.";
  const owed = isFlight
    ? "If the airline cancels or significantly changes your flight (to, from or within the US) and you choose not to travel, you're owed a full refund. Request it in Trips or reply to this email."
    : "";
  const html = renderEmail({
    preheader: `${s.title}. Here's what it means for your trip.`,
    title: s.title,
    introHtml: subLine(esc(s.message)),
    bodyHtml:
      detailBox("Your trip", subLine(esc(b.tripDetails || b.type))) +
      detailBox(
        "What to do",
        subLine(esc(what)) + (owed ? noteLine(esc(owed)) : "")
      ) +
      noteLine(
        `Skyrio doesn't control airline or hotel decisions. We'll help you through them. More: <a href="${APP_URL}${HELP_PATH}">${APP_URL.replace(/^https?:\/\//, "")}${HELP_PATH}</a>`
      ),
    cta: { label: "View my trip", url: manageUrl },
  });
  const text = [
    s.title,
    s.message,
    `Your trip: ${b.tripDetails || b.type}`,
    what,
    owed,
    `View your trip: ${manageUrl}`,
    `What to do when travel is disrupted: ${APP_URL}${HELP_PATH}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

/**
 * Emails each affected traveler once per alert. dryRun returns the count
 * and a short sample without sending.
 */
export async function notifyAffectedTravelers({ hours, verticals, airports, dryRun = true, by = "admin" }) {
  const s = await getSiteStatus({ fresh: true });
  if (!s?.active) return { ok: false, error: "Post an alert first." };

  const all = await findAffectedBookings({ hours, verticals, airports });
  const already = new Set(s.notifiedBookingIds || []);
  const todo = all.filter((b) => !already.has(String(b._id)));

  // Account holders: use the account's current email.
  const userIds = [...new Set(todo.filter((b) => b.user).map((b) => String(b.user)))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("email").lean()
    : [];
  const emailOf = Object.fromEntries(users.map((u) => [String(u._id), u.email]));
  const withEmail = todo
    .map((b) => ({ b, to: (b.user && emailOf[String(b.user)]) || b.email }))
    .filter((x) => x.to);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      matched: all.length,
      alreadyEmailed: all.length - todo.length,
      toEmail: withEmail.length,
      noEmail: todo.length - withEmail.length,
      sample: withEmail.slice(0, 5).map(({ b }) => ({
        type: b.type,
        trip: String(b.tripDetails || "").slice(0, 80),
      })),
    };
  }

  // Mark first, so a double tap can't email anyone twice.
  const ids = withEmail.map(({ b }) => String(b._id));
  await SiteStatus.updateOne(
    { key: "current", version: s.version },
    { $addToSet: { notifiedBookingIds: { $each: ids } } }
  );
  bust();

  // Send in the background, slowly (email provider rate limits).
  (async () => {
    let sent = 0;
    for (const { b, to } of withEmail) {
      const manageUrl = b.user ? TRIPS_URL : manageUrlFor(b._id);
      const { html, text } = alertEmail(s, b, manageUrl);
      const r = await sendEmail({
        to,
        subject: `Travel alert: ${s.title}`,
        html,
        text,
        tag: "travel-alert",
      }).catch(() => null);
      if (r?.ok) sent++;
      await new Promise((r) => setTimeout(r, 600));
    }
    console.log(`[site-status] alert emails: ${sent}/${withEmail.length} sent (by ${by})`);
  })();

  return { ok: true, queued: withEmail.length, alreadyEmailed: all.length - todo.length };
}
