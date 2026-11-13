// Admin "Customers" lookup — find anyone (account OR guest) and see
// everything about them in one place: profile, bookings, support tickets.
//
// Mount in routes/api/index.js, ABOVE the "/admin" mount:
//   await mount("/admin/customers", "../adminCustomers.js");
//
// Booking actions (cancel, refund, live supplier status, notes) stay in
// bookings.routes.js (/api/bookings/admin/*) — this file only finds people
// and adds "send their manage link".

import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/user.js";
import Booking from "../models/booking.js";
import SupportTicket from "../controllers/support.controller.js";
import { verifyAdmin } from "./admin.routes.js";
import { manageUrlFor } from "../services/manageLink.js";
import { sendManageLinkEmail } from "../services/manageEmails.js";
import {
  launchTravelerStatus,
  revokeLaunchTraveler,
} from "../services/xpService.js";

const router = Router();
router.use(verifyAdmin);

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (e = "") => String(e).trim().toLowerCase();

// What the dashboard needs about a booking — no card or supplier payloads.
const BOOKING_FIELDS = [
  "user",
  "name",
  "email",
  "claimedAt",
  "tripDetails",
  "type",
  "flight",
  "hotelStay.rooms.name",
  "hotelStay.rooms.checkin",
  "hotelStay.rooms.checkout",
  "hotelStay.hotelName",
  "syncGroup",
  "sharedRoom",
  "confirmationEmail.status",
  "provider",
  "providerBookingIds",
  "confirmationCodes",
  "dates",
  "travelers",
  "passengers.name",
  "status",
  "cancelRequest.status",
  "cancelRequest.at",
  "cancellation.at",
  "cancellation.by",
  "total",
  "totalAmount",
  "totalCurrency",
  "paidAt",
  "stripePaymentIntentId",
  "refundStatus",
  "refundAmount",
  "refundedAt",
  "createdAt",
].join(" ");

/** Admin view of an account. Leaves out DOB, traveler numbers, tokens. */
function accountView(u) {
  const level = u.getXPLevel?.() || {};
  const tp = u.travelProfile || {};
  const legalName = [tp.legalFirstName, tp.legalMiddleName, tp.legalLastName]
    .filter(Boolean)
    .join(" ");
  return {
    id: String(u._id),
    name: u.name || "",
    username: u.username,
    email: u.email,
    emailVerified: !!u.emailVerified,
    avatar: u.avatar,
    city: u.city || "",
    homeAirport: u.homeAirport?.code ? u.homeAirport : null,
    phone: tp.phone || "",
    legalName, // helps when a booking fails over a name mismatch
    companionsCount: tp.companions?.length || 0,
    card: u.defaultPaymentMethodSummary?.last4
      ? {
          brand: u.defaultPaymentMethodSummary.brand,
          last4: u.defaultPaymentMethodSummary.last4,
        }
      : null,
    plan: u.plan || "free",
    subscription: {
      status: u.subscription?.status || null,
      interval: u.subscription?.interval || null,
      currentPeriodEnd: u.subscription?.currentPeriodEnd || null,
      cancelAtPeriodEnd: !!u.subscription?.cancelAtPeriodEnd,
    },
    stripeCustomerId: u.stripeCustomerId || null,
    xp: u.xp || 0,
    xpTotalEarned: u.xpTotalEarned ?? u.xp ?? 0,
    pendingXp: u.pendingXp || 0,
    rank: level.levelLabel || null,
    referralsCount: u.referralsCount || 0,
    role: u.role,
    isActive: u.isActive !== false,
    moderationStatus: u.getModerationStatus?.() || u.moderation?.status || "ok",
    createdAt: u.createdAt,
  };
}

/* ── GET /api/admin/customers/search?q= ───────────────────────────
   Finds accounts and guests by name, email, username, phone, booking
   id or confirmation code. Guests are grouped by email. */
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 80);
    if (q.length < 2) return res.json({ ok: true, results: [] });
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");

    const userOr = [
      { email: rx },
      { name: rx },
      { username: rx },
      { "travelProfile.legalLastName": rx },
    ];
    if (digits.length >= 4) {
      userOr.push({
        "travelProfile.phone": new RegExp(digits.split("").join("\\D*")),
      });
    }

    const bookingOr = [
      { email: rx },
      { name: rx },
      { "passengers.name": rx },
      { confirmationCodes: rx },
      { providerBookingIds: rx },
    ];
    if (mongoose.isValidObjectId(q)) bookingOr.push({ _id: q });

    const [users, bookings, tickets] = await Promise.all([
      User.find({ $or: userOr })
        .select("name username email avatar plan createdAt")
        .limit(15)
        .lean(),
      Booking.find({ $or: bookingOr })
        .select("user name email createdAt")
        .sort({ createdAt: -1 })
        .limit(60)
        .lean(),
      SupportTicket.find({ $or: [{ name: rx }, { email: rx }] })
        .select("name email userId createdAt")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
    ]);

    // Bookings/tickets that belong to an account pull that account in.
    const extraUserIds = [
      ...bookings.filter((b) => b.user).map((b) => String(b.user)),
      ...tickets.filter((t) => t.userId).map((t) => String(t.userId)),
    ].filter((id) => !users.some((u) => String(u._id) === id));
    const extraUsers = extraUserIds.length
      ? await User.find({ _id: { $in: [...new Set(extraUserIds)] } })
          .select("name username email avatar plan createdAt")
          .lean()
      : [];
    const allUsers = [...users, ...extraUsers];
    const accountEmails = new Set(allUsers.map((u) => norm(u.email)));

    // Guests: grouped by email, skipping emails that belong to an account.
    const guests = new Map();
    const addGuest = (email, name, at, isBooking) => {
      const key = norm(email);
      if (!key || accountEmails.has(key)) return;
      const g = guests.get(key) || {
        kind: "guest",
        email: key,
        name: "",
        bookings: 0,
        tickets: 0,
        lastSeen: null,
      };
      if (!g.name && name) g.name = name;
      if (isBooking) g.bookings += 1;
      else g.tickets += 1;
      if (!g.lastSeen || new Date(at) > new Date(g.lastSeen)) g.lastSeen = at;
      guests.set(key, g);
    };
    bookings
      .filter((b) => !b.user)
      .forEach((b) => addGuest(b.email, b.name, b.createdAt, true));
    tickets
      .filter((t) => !t.userId)
      .forEach((t) => addGuest(t.email, t.name, t.createdAt, false));

    // Booking counts for the accounts found.
    const counts = allUsers.length
      ? await Booking.aggregate([
          { $match: { user: { $in: allUsers.map((u) => u._id) } } },
          { $group: { _id: "$user", n: { $sum: 1 } } },
        ])
      : [];
    const countOf = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

    const results = [
      ...allUsers.map((u) => ({
        kind: "account",
        id: String(u._id),
        name: u.name || u.username,
        username: u.username,
        email: u.email,
        avatar: u.avatar,
        plan: u.plan || "free",
        bookings: countOf[String(u._id)] || 0,
        lastSeen: u.createdAt,
      })),
      ...guests.values(),
    ].slice(0, 25);

    res.json({ ok: true, results });
  } catch (err) {
    console.error("[admin/customers] search error:", err);
    res.status(500).json({ ok: false, message: "Search failed." });
  }
});

/* ── GET /api/admin/customers/profile?userId=… | ?email=… ─────────
   Everything about one person. For an account this also includes guest
   bookings made with the same email that were never claimed. */
router.get("/profile", async (req, res) => {
  try {
    const { userId } = req.query;
    let email = norm(req.query.email);
    let account = null;

    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ ok: false, message: "Invalid user id." });
      }
      const u = await User.findById(userId);
      if (!u) {
        return res.status(404).json({ ok: false, message: "User not found." });
      }
      account = accountView(u);
      email = norm(u.email);
    } else if (email) {
      // An email that belongs to an account opens the account.
      const u = await User.findOne({ email });
      if (u) account = accountView(u);
    } else {
      return res
        .status(400)
        .json({ ok: false, message: "Send a userId or an email." });
    }

    const emailRx = new RegExp(`^${escapeRegex(email)}$`, "i");
    const bookingFilter = account
      ? { $or: [{ user: account.id }, { user: null, email: emailRx }] }
      : { user: null, email: emailRx };
    const ticketFilter = account
      ? { $or: [{ userId: account.id }, { email: emailRx }] }
      : { email: emailRx };

    const [bookings, tickets] = await Promise.all([
      Booking.find(bookingFilter)
        .select(BOOKING_FIELDS)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      SupportTicket.find(ticketFilter)
        .select("category message status urgent source createdAt replies")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const guestName = account ? "" : bookings.find((b) => b.name)?.name || "";

    const stats = {
      bookings: bookings.length,
      upcoming: bookings.filter(
        (b) =>
          b.status === "confirmed" &&
          b.dates?.start &&
          new Date(b.dates.start) > new Date()
      ).length,
      cancelRequests: bookings.filter((b) => b.cancelRequest?.status === "open")
        .length,
      spent: bookings
        .filter((b) => b.status === "confirmed")
        .reduce((sum, b) => sum + (Number(b.total) || 0), 0),
      openTickets: tickets.filter((t) =>
        ["open", "in_progress"].includes(t.status)
      ).length,
    };

    let launchTraveler = null;
    if (account) {
      const [st, flags] = await Promise.all([
        launchTravelerStatus(account.id),
        User.findById(account.id)
          .select("launchTravelerBlocked launchTravelerBlockedReason")
          .lean(),
      ]);
      launchTraveler = {
        ...st,
        blocked: Boolean(flags?.launchTravelerBlocked),
        blockedReason: flags?.launchTravelerBlockedReason || null,
      };
    }

    res.json({
      ok: true,
      kind: account ? "account" : "guest",
      launchTraveler,
      account,
      guest: account ? null : { email, name: guestName },
      stats,
      bookings: bookings.map((b) => ({
        ...b,
        unclaimedGuest: Boolean(account && !b.user),
      })),
      tickets: tickets.map((t) => ({
        ...t,
        replies: t.replies?.length || 0,
      })),
    });
  } catch (err) {
    console.error("[admin/customers] profile error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Couldn't load this customer." });
  }
});

/* ── Launch Traveler badge (fraud tools) ───────────────────────────
   POST /api/admin/customers/:userId/launch-traveler/revoke
     Body: { reason?: string, block?: boolean (default true) }
     Takes the badge and its XP back; block stops the account earning it again.
   POST /api/admin/customers/:userId/launch-traveler/unblock
     Lets the account earn it again with a new qualifying trip. */
router.post("/:userId/launch-traveler/revoke", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ ok: false, message: "Invalid user id." });
  }
  try {
    const reason =
      String(req.body?.reason || "").trim().slice(0, 200) || "revoked by admin";
    const block = req.body?.block !== false;
    const reversed = await revokeLaunchTraveler(userId, { reason, block });
    console.log(
      `[admin] launch traveler revoked for ${userId} by ${req.user?.id || "admin"} (block=${block}, rows=${reversed})`
    );
    res.json({ ok: true, reversed, blocked: block });
  } catch (err) {
    console.error("[admin/customers] launch revoke error:", err);
    res.status(500).json({ ok: false, message: "Couldn't revoke the badge. Try again." });
  }
});

router.post("/:userId/launch-traveler/unblock", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ ok: false, message: "Invalid user id." });
  }
  try {
    await User.updateOne(
      { _id: userId },
      { $set: { launchTravelerBlocked: false, launchTravelerBlockedReason: null } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin/customers] launch unblock error:", err);
    res.status(500).json({ ok: false, message: "Couldn't unblock. Try again." });
  }
});

/* ── POST /api/admin/customers/bookings/:id/manage-link ───────────
   Body: { email?: boolean }  (default true)
   Emails the traveler their "Manage or cancel" link and returns it so
   you can also paste it into a reply. */
router.post("/bookings/:id/manage-link", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid booking id." });
    }
    const booking = await Booking.findById(req.params.id).populate(
      "user",
      "email"
    );
    if (!booking) {
      return res.status(404).json({ ok: false, message: "Booking not found." });
    }
    const url = manageUrlFor(booking._id);
    const to = booking.email || booking.user?.email;
    let emailed = false;
    if (req.body?.email !== false) {
      if (!to) {
        return res
          .status(400)
          .json({ ok: false, message: "No email on this booking." });
      }
      await sendManageLinkEmail({ to, booking });
      emailed = true;
    }
    res.json({ ok: true, url, emailed, to });
  } catch (err) {
    console.error("[admin/customers] manage-link error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Couldn't send the manage link." });
  }
});

export default router;
