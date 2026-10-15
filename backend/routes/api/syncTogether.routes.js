import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";
import SyncGroup from "../../models/SyncGroup.js";
import Booking from "../../models/booking.js";
import SplitPayment from "../../models/SplitPayment.js";
import Notification from "../../models/notification.js";
import { auth as authRequired } from "../../middleware/auth.js";
import {
  sendTripInvite,
  sendPlanReady,
  sendTripDeleted,
  sendMemberRemoved,
} from "../../services/email.js";
import {
  sendGroupReminder,
  groupUrl as groupLink,
} from "../../services/syncEmails.js";
import { sendConfirmationFor } from "../../services/bookingConfirmations.js";
import {
  notifyGroupMessage,
  markGroupRead,
  markViewing,
} from "../../utils/notifyGroupMessage.js";
import {
  SyncError,
  HOLD_HOURS,
  setSyncIo,
  isOrganizer,
  travelersOf,
  sharedRoomForClient,
  createSharedRoom,
  startShareHold,
  confirmShareHold,
  releaseSharedRoom,
  releaseRoomsForUser,
  expireDueSharedRooms,
  sharedRoomCancelQuote,
  cancelSharedRoom,
  startSharedRoomJobs,
} from "../../services/sharedRooms.js";

const router = Router();

// Releases shared-room holds whose deadline has passed (every 10 minutes).
startSharedRoomJobs();

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (id) => mongoose.isValidObjectId(id);

function sendSyncError(res, err, fallback) {
  if (err instanceof SyncError) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  console.error(`[sync-together] ${fallback}:`, err);
  return res.status(500).json({ ok: false, error: fallback });
}

/* ──────────────────────────────────────────────
   GET /api/sync-together/preview/:code
   PUBLIC — no auth required. Lets someone who
   just clicked an invite link see what trip
   they're being invited to before signing in.
   ────────────────────────────────────────────── */
router.get("/preview/:code", async (req, res) => {
  try {
    const group = await SyncGroup.findOne({ inviteCode: req.params.code })
      .populate("owner", "username name avatar")
      .lean();

    if (!group)
      return res.status(404).json({ ok: false, error: "Invite not found" });

    return res.json({
      ok: true,
      preview: {
        id: group._id,
        title: group.title || "Untitled Trip",
        destination: group.destination || null,
        dateRangeStart: group.dateRangeStart || null,
        dateRangeEnd: group.dateRangeEnd || null,
        ownerName: group.owner?.name || group.owner?.username || "Someone",
        ownerAvatar: group.owner?.avatar || null,
        memberCount: (group.members?.length || 0) + 1,
        status: group.status,
      },
    });
  } catch (err) {
    console.error("[sync-together] preview error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load invite" });
  }
});

router.use(authRequired);
router.use((req, _res, next) => {
  setSyncIo(req.app.get("io"));
  next();
});
// ── Budgets are private ──
// Every response that includes a group drops other people's budgets and
// adds: myBudget (yours) and budgetSummary (the group's comfort level,
// with no names). Budgets are personal — people shouldn't see each other's.
function budgetSummaryFor(g) {
  const going = (g.members || []).filter((m) => m.status !== "declined");
  const values = [g.ownerBudget, ...going.map((m) => m.budget)]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const travelers = going.length + 1;
  if (!values.length) return { set: 0, travelers, comfortable: null };
  // Round down to the nearest $50 so it reads as a range, not someone's exact number.
  const lowest = Math.floor(Math.min(...values) / 50) * 50;
  return { set: values.length, travelers, comfortable: Math.max(lowest, 50) };
}
function privateGroup(group, viewerId) {
  if (!group || typeof group !== "object") return group;
  const g =
    typeof group.toObject === "function" ? group.toObject() : { ...group };
  const ownerId = String(g.owner?._id || g.owner || "");
  const me = String(viewerId || "");
  const mine =
    ownerId === me
      ? g.ownerBudget
      : (g.members || []).find(
          (m) => String(m.user?._id || m.user || "") === me
        )?.budget;
  g.budgetSummary = budgetSummaryFor(g);
  g.myBudget =
    Number.isFinite(Number(mine)) && Number(mine) > 0 ? Number(mine) : null;
  delete g.ownerBudget;
  if (Array.isArray(g.members))
    g.members = g.members.map(({ budget, ...rest }) => rest);
  return g;
}
router.use((req, res, next) => {
  const send = res.json.bind(res);
  res.json = (body) => {
    if (body && (body.group || Array.isArray(body.groups))) {
      try {
        const viewer = req.user?.id ?? req.user?._id;
        body = { ...body };
        if (body.group) body.group = privateGroup(body.group, viewer);
        if (Array.isArray(body.groups))
          body.groups = body.groups.map((g) => privateGroup(g, viewer));
      } catch {
        /* never block a response over this */
      }
    }
    return send(body);
  };
  next();
});

router.param("id", (req, res, next, id) =>
  validId(id)
    ? next()
    : res.status(404).json({ ok: false, error: "Group not found" })
);

/* ──────────────────────────────────────────────
   POST /api/sync-together/join/:code
   Adds the currently authenticated user as a
   member of the group matching this invite code.
   ────────────────────────────────────────────── */
router.post("/join/:code", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findOne({ inviteCode: req.params.code });

    if (!group)
      return res.status(404).json({ ok: false, error: "Invite not found" });

    // Already the owner or already a member — just send them to the trip
    if (isGroupMember(group, userId)) {
      const populated = await SyncGroup.findById(group._id)
        .populate("owner", "username name avatar")
        .populate("members.user", "username name avatar")
        .lean();
      return res.json({ ok: true, group: populated, alreadyMember: true });
    }

    const user = await User.findById(userId)
      .select("name username email")
      .lean();

    // Invited by email before they had an account? Claim that spot
    // instead of adding them twice.
    const emailInvite =
      user?.email &&
      group.members.find(
        (m) =>
          !m.user && m.email && m.email === String(user.email).toLowerCase()
      );
    if (emailInvite) {
      emailInvite.user = userId;
      emailInvite.name =
        emailInvite.name || user?.name || user?.username || null;
      emailInvite.status = "accepted";
      emailInvite.joinedAt = new Date();
    } else {
      group.members.push({
        user: userId,
        email: user?.email || null,
        name: user?.name || user?.username || null,
        status: "accepted",
        joinedAt: new Date(),
      });
    }

    logActivity(
      group,
      "member_added",
      userId,
      `${user?.name || user?.username || "A traveler"} joined via invite link`
    );

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated, alreadyMember: false });
  } catch (err) {
    console.error("[sync-together] join error:", err);
    return res.status(500).json({ ok: false, error: "Failed to join trip" });
  }
});

/* ── Helper: check if user is owner or member ── */
function isGroupMember(group, userId) {
  if (String(group.owner._id || group.owner) === String(userId)) return true;
  return group.members.some(
    (m) => m.user && String(m.user._id || m.user) === String(userId)
  );
}

/* ── Helper: push activity log entry ── */
function logActivity(group, type, userId, message) {
  if (!group.activityLog) group.activityLog = [];
  group.activityLog.push({
    type,
    user: userId,
    message,
    createdAt: new Date(),
  });
}

/* ── Helper: full populate chain ── */
function fullPopulate(query) {
  return query
    .populate("owner", "username name avatar")
    .populate("members.user", "username name avatar")
    .populate("changeRequests.user", "username name avatar")
    .populate("chatMessages.user", "username name avatar")
    .populate("activityLog.user", "username name avatar");
}

/* ──────────────────────────────────────────────
   GET /api/sync-together/count
   Total trip count (for social proof).
   ────────────────────────────────────────────── */
router.get("/count", async (_req, res) => {
  try {
    const count = await SyncGroup.countDocuments({
      status: { $ne: "cancelled" },
    });
    return res.json({ ok: true, count });
  } catch (err) {
    return res.json({ ok: true, count: 0 });
  }
});

/* ──────────────────────────────────────────────
   GET /api/sync-together/search?q=john
   ────────────────────────────────────────────── */
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ ok: true, users: [] });

    const regex = new RegExp(escapeRegex(q.trim().slice(0, 60)), "i");
    const selfId = req.user?.id ?? req.user?._id ?? null;

    const filter = {
      isActive: true,
      $or: [{ username: regex }, { name: regex }, { email: regex }],
    };
    if (selfId) filter._id = { $ne: selfId };

    const users = await User.find(filter)
      .select("username name email avatar xp")
      .limit(10)
      .lean();

    return res.json({ ok: true, users });
  } catch (err) {
    console.error("[sync-together] search error:", err);
    return res.status(500).json({ ok: false, error: "Search failed" });
  }
});

/* ──────────────────────────────────────────────
   GET /api/sync-together/my-trips
   Get all groups where user is owner or member.
   ────────────────────────────────────────────── */
router.get("/my-trips", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;

    const groups = await SyncGroup.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .sort({ updatedAt: -1 })
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .lean();

    return res.json({ ok: true, groups });
  } catch (err) {
    console.error("[sync-together] my-trips error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch trips" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together
   Create a new SyncGroup.
   Now accepts destination/dates/airport/cabinClass at
   creation time so invite emails reflect real trip info
   instead of showing "Untitled Trip" with no context.
   ────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const ownerId = req.user?.id ?? req.user?._id;
    if (!ownerId)
      return res.status(401).json({ ok: false, error: "Not authenticated" });

    const {
      members = [],
      title,
      destination,
      dateRangeStart,
      dateRangeEnd,
      departureAirport,
      cabinClass,
    } = req.body;
    if (!members.length)
      return res
        .status(400)
        .json({ ok: false, error: "Add at least one traveler" });

    const memberDocs = members.map((m) => ({
      user: m.userId || null,
      email: m.email || null,
      name: m.name || null,
      status: "pending",
    }));

    const group = await SyncGroup.create({
      owner: ownerId,
      title: title || "Untitled Trip",
      destination: destination || null,
      dateRangeStart: dateRangeStart || null,
      dateRangeEnd: dateRangeEnd || null,
      departureAirport: departureAirport || null,
      cabinClass: cabinClass || null,
      members: memberDocs,
      status: "inviting",
      activityLog: [
        {
          type: "created",
          user: ownerId,
          message: "Trip created",
          createdAt: new Date(),
        },
      ],
    });

    // Send invite emails (non-blocking — don't fail the request if email fails)
    try {
      const owner = await User.findById(ownerId)
        .select("name username email")
        .lean();
      const inviterName = owner?.name || owner?.username || "Someone";
      const memberNames = memberDocs
        .map((m) => m.name || m.email)
        .filter(Boolean)
        .join(", ");

      for (const m of memberDocs) {
        let email = m.email;
        if (!email && m.user) {
          const u = await User.findById(m.user).select("email").lean();
          email = u?.email;
        }
        if (email) {
          sendTripInvite({
            to: email,
            inviterName,
            tripTitle: group.title,
            destination: group.destination || null,
            inviteCode: group.inviteCode,
            memberNames,
          }).catch((err) => console.error("[email] invite error:", err));
        }
      }
    } catch (emailErr) {
      console.error("[email] Failed to send invites:", emailErr.message);
    }

    return res.status(201).json({ ok: true, group: group.toSafeJSON() });
  } catch (err) {
    console.error("[sync-together] create error:", err);
    return res.status(500).json({ ok: false, error: "Could not create group" });
  }
});

/* ──────────────────────────────────────────────
   GET /api/sync-together/:id
   ────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id))
      return res.status(404).json({ ok: false, error: "Group not found" });
    const group = await fullPopulate(SyncGroup.findById(req.params.id)).lean();

    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, req.user?.id ?? req.user?._id)) {
      return res.status(403).json({
        ok: false,
        error: "You're not on this trip. Ask the organizer for an invite link.",
      });
    }

    return res.json({ ok: true, group });
  } catch (err) {
    console.error("[sync-together] fetch error:", err);
    return res.status(500).json({ ok: false, error: "Fetch failed" });
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/sync-together/:id
   Update group details. Any member can edit.
   ────────────────────────────────────────────── */
router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    // Only the organizer edits the trip itself (where, when, cabin).
    // Members suggest changes with "Request a change".
    if (String(group.owner) !== String(userId)) {
      return res.status(403).json({
        ok: false,
        error:
          "Only the organizer can edit trip details. Use “Request a change” to suggest one.",
      });
    }

    const {
      title,
      destination,
      departureAirport,
      cabinClass,
      departureTime,
      dateRangeStart,
      dateRangeEnd,
    } = req.body;
    // Budgets are set per person with PATCH /:id/my-budget.
    // `status` is no longer accepted here — it only changes through the
    // plan / approve / confirm steps, so members can't skip ahead.

    if (title !== undefined)
      group.title = String(title).trim().slice(0, 120) || "Untitled Trip";
    if (destination !== undefined) group.destination = destination;
    if (departureAirport !== undefined)
      group.departureAirport = departureAirport;
    if (cabinClass !== undefined) group.cabinClass = cabinClass;
    if (departureTime !== undefined) group.departureTime = departureTime;
    if (dateRangeStart !== undefined) group.dateRangeStart = dateRangeStart;
    if (dateRangeEnd !== undefined) group.dateRangeEnd = dateRangeEnd;

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] patch error:", err);
    return res.status(500).json({ ok: false, error: "Update failed" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/plan
   Save Atlas's plan to the group.
   ────────────────────────────────────────────── */
router.post("/:id/plan", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only group members can update the plan" });
    }

    const { plan, atlasMessages } = req.body;

    group.plan = plan;
    group.planGeneratedAt = new Date();
    group.planVersion = (group.planVersion || 0) + 1;
    if (atlasMessages) group.atlasMessages = atlasMessages;
    group.status = "reviewing";

    // Reset all approvals when plan changes
    group.members.forEach((m) => {
      m.approved = false;
      m.approvedAt = null;
    });

    logActivity(
      group,
      group.planVersion <= 1 ? "plan_generated" : "plan_updated",
      userId,
      `Plan v${group.planVersion} generated`
    );

    await group.save();

    // Notify all other members the plan is ready (non-blocking)
    try {
      const planner = await User.findById(userId)
        .select("name username")
        .lean();
      const plannerName = planner?.name || planner?.username || "Someone";
      // FRONTEND_ORIGIN is a comma-separated list, so never paste it into a
      // link directly — use the one shared link builder.
      const groupUrl = groupLink(group._id);

      for (const m of group.members) {
        // Skip notifying the person who just generated the plan
        if (m.user && String(m.user) === String(userId)) continue;

        let email = m.email;
        if (!email && m.user) {
          const u = await User.findById(m.user).select("email").lean();
          email = u?.email;
        }
        if (email) {
          sendPlanReady({
            to: email,
            tripTitle: group.title,
            destination: group.destination,
            plannerName,
            groupUrl,
          }).catch((err) => console.error("[email] plan-ready error:", err));
        }
      }
    } catch (emailErr) {
      console.error(
        "[email] Failed to send plan-ready notifications:",
        emailErr.message
      );
    }

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] plan error:", err);
    return res.status(500).json({ ok: false, error: "Failed to save plan" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/approve
   Member approves the current plan.
   ────────────────────────────────────────────── */
router.post("/:id/approve", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );

    const isOwner = String(group.owner) === String(userId);

    if (!member && !isOwner) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    if (member) {
      member.approved = true;
      member.approvedAt = new Date();
    }

    const allApproved = group.members.every(
      (m) => m.approved || m.status === "declined"
    );

    if (allApproved) {
      group.status = "confirmed";
      group.bookingOpenedAt = group.bookingOpenedAt || new Date();
    }

    logActivity(
      group,
      "approved",
      userId,
      allApproved ? "Everyone approved" : "Approved the plan"
    );

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated, allApproved });
  } catch (err) {
    console.error("[sync-together] approve error:", err);
    return res.status(500).json({ ok: false, error: "Approval failed" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/change-request
   Member requests a change to the plan.
   ────────────────────────────────────────────── */
router.post("/:id/change-request", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, userId)) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message is required" });
    }

    group.changeRequests.push({
      user: userId,
      message: message.trim(),
      status: "open",
    });

    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );
    if (member) {
      member.approved = false;
      member.approvedAt = null;
    }

    if (group.status === "confirmed") {
      group.status = "reviewing";
    }

    logActivity(group, "change_requested", userId, message.trim());

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] change-request error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to submit change request" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/confirm
   Organizer locks in the plan (all must approve).
   ────────────────────────────────────────────── */
router.post("/:id/confirm", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    if (String(group.owner) !== String(userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only the organizer can confirm the trip" });
    }

    const openRequests = group.changeRequests.filter(
      (cr) => cr.status === "open"
    );
    if (openRequests.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `There are ${openRequests.length} open change request(s). Resolve them before confirming.`,
      });
    }

    group.status = "booked";
    group.changeRequests.forEach((cr) => {
      if (cr.status === "open") cr.status = "resolved";
    });

    logActivity(group, "booked", userId, "Trip confirmed and locked");

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] confirm error:", err);
    return res.status(500).json({ ok: false, error: "Confirmation failed" });
  }
});

/* ──────────────────────────────────────────────
   DELETE /api/sync-together/:id/member/:memberId
   Remove a member from the group.
   ────────────────────────────────────────────── */
router.delete("/:id/member/:memberId", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    if (!isGroupMember(group, userId)) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    const memberIndex = group.members.findIndex(
      (m) => String(m._id) === String(req.params.memberId)
    );

    if (memberIndex === -1) {
      return res.status(404).json({ ok: false, error: "Member not found" });
    }

    // Grab contact info before splicing them out of the array
    const removedMember = group.members[memberIndex];
    const removedEmail = removedMember.email;
    const removedUserId = removedMember.user;
    const leavingSelf =
      removedUserId && String(removedUserId) === String(userId);

    // The organizer can remove anyone; everyone else can only leave.
    if (!leavingSelf && !isOrganizer(group, userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can remove other travelers",
      });
    }

    // A shared room still collecting holds can't go ahead without them —
    // release it so nobody is charged for a room that no longer adds up.
    // Anything already booked stays theirs (they cancel it from My Trips).
    if (removedUserId) await releaseRoomsForUser(group._id, removedUserId);

    group.members.splice(memberIndex, 1);
    logActivity(
      group,
      leavingSelf ? "member_left" : "member_removed",
      userId,
      leavingSelf ? "Left the trip" : "A member was removed"
    );
    await group.save();

    if (leavingSelf) return res.json({ ok: true, left: true });

    // Notify the removed member (non-blocking)
    try {
      const remover = await User.findById(userId)
        .select("name username")
        .lean();
      const removerName = remover?.name || remover?.username || "A trip member";

      let email = removedEmail;
      if (!email && removedUserId) {
        const u = await User.findById(removedUserId).select("email").lean();
        email = u?.email;
      }
      if (email) {
        sendMemberRemoved({
          to: email,
          tripTitle: group.title,
          destination: group.destination,
          ownerName: removerName,
        }).catch((err) => console.error("[email] member-removed error:", err));
      }
    } catch (emailErr) {
      console.error(
        "[email] Failed to send member-removed notification:",
        emailErr.message
      );
    }

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] remove member error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to remove member" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/member
   Add a member to the group.
   Body: { userId?, email?, name? }
   ────────────────────────────────────────────── */
router.post("/:id/member", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    if (!isGroupMember(group, userId)) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    const { userId: newUserId, email, name } = req.body;

    const alreadyExists = group.members.some((m) => {
      if (newUserId && m.user && String(m.user) === String(newUserId))
        return true;
      if (email && m.email === email) return true;
      return false;
    });

    if (alreadyExists) {
      return res.status(400).json({ ok: false, error: "Already in the group" });
    }

    group.members.push({
      user: newUserId || null,
      email: email || null,
      name: name || null,
      status: "pending",
    });

    logActivity(
      group,
      "member_added",
      userId,
      `${name || email || "A traveler"} was added`
    );
    await group.save();

    // Send invite email to new member (non-blocking)
    try {
      const owner = await User.findById(userId).select("name username").lean();
      const inviterName = owner?.name || owner?.username || "Someone";
      let memberEmail = email;
      if (!memberEmail && newUserId) {
        const u = await User.findById(newUserId).select("email").lean();
        memberEmail = u?.email;
      }
      if (memberEmail) {
        sendTripInvite({
          to: memberEmail,
          inviterName,
          tripTitle: group.title,
          destination: group.destination,
          inviteCode: group.inviteCode,
          memberNames: null,
        }).catch((err) => console.error("[email] invite error:", err));
      }
    } catch (emailErr) {
      console.error("[email] Failed to send invite:", emailErr.message);
    }

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] add member error:", err);
    return res.status(500).json({ ok: false, error: "Failed to add member" });
  }
});

/* ──────────────────────────────────────────────
   DELETE /api/sync-together/:id
   Delete a group (owner only).
   ────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (String(group.owner) !== String(userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only the organizer can delete this trip" });
    }

    // NEW: travelers' real bookings point at this trip — don't delete it
    // out from under them.
    const linkedBookings = await Booking.countDocuments({
      status: { $in: ["confirmed", "cancel_pending"] },
      ...linkedToGroup(group._id),
    });
    if (linkedBookings) {
      return res.status(409).json({
        ok: false,
        error:
          "Travelers have already booked parts of this trip. Each person can take their booking off the trip (or cancel it from My Trips) before it can be deleted.",
      });
    }

    const liveRooms = await SplitPayment.countDocuments({
      group: group._id,
      kind: "shared_room",
      status: { $in: ["booking", "booked"] },
    });
    if (liveRooms) {
      return res.status(409).json({
        ok: false,
        error:
          "This trip has a booked shared room. Cancel it from the trip page first — only you can cancel it.",
      });
    }
    const collecting = await SplitPayment.find({
      group: group._id,
      kind: "shared_room",
      status: "collecting",
    })
      .select("_id")
      .lean();
    for (const c of collecting) await releaseSharedRoom(c._id, "released");

    // Notify all members before the group is gone (non-blocking —
    // don't fail the delete if an email fails)
    try {
      const owner = await User.findById(userId).select("name username").lean();
      const ownerName = owner?.name || owner?.username || "The organizer";

      for (const m of group.members) {
        let email = m.email;
        if (!email && m.user) {
          const u = await User.findById(m.user).select("email").lean();
          email = u?.email;
        }
        if (email) {
          sendTripDeleted({
            to: email,
            tripTitle: group.title,
            destination: group.destination,
            ownerName,
          }).catch((err) => console.error("[email] trip-deleted error:", err));
        }
      }
    } catch (emailErr) {
      console.error(
        "[email] Failed to send trip-deleted notifications:",
        emailErr.message
      );
    }

    await SyncGroup.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[sync-together] delete error:", err);
    return res.status(500).json({ ok: false, error: "Failed to delete" });
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/sync-together/:id/member-airport
   Update your own departure airport.
   Body: { departureAirport: "JFK" }
   ────────────────────────────────────────────── */
router.patch("/:id/member-airport", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

    const { departureAirport } = req.body;

    if (String(group.owner) === String(userId)) {
      group.departureAirport = departureAirport;
    }

    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );
    if (member) {
      member.departureAirport = departureAirport;
    }

    if (!member && String(group.owner) !== String(userId)) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .populate("chatMessages.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] member-airport error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to update airport" });
  }
});

/* ──────────────────────────────────────────────
   POST /api/sync-together/:id/chat
   Send a chat message.
   ────────────────────────────────────────────── */
router.post("/:id/chat", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, userId)) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message is required" });
    }

    group.chatMessages.push({
      user: userId,
      message: message.trim().slice(0, 2000),
    });

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .select("chatMessages")
      .populate("chatMessages.user", "username name avatar")
      .lean();

    const newMsg = populated.chatMessages[populated.chatMessages.length - 1];

    // Bell notification for everyone else on the trip (non-blocking —
    // never fail the send because a notification didn't go out).
    const memberIds = [
      group.owner,
      ...group.members
        .filter((m) => m.user && m.status !== "declined")
        .map((m) => m.user),
    ];
    notifyGroupMessage(req.app.get("io"), {
      groupId: group._id,
      groupName: group.title || "Your trip",
      senderId: userId,
      senderName: newMsg?.user?.name || newMsg?.user?.username || "Someone",
      preview: newMsg?.message || message.trim(),
      memberIds,
    }).catch((err) => console.error("[sync-together] chat notify error:", err));

    return res.json({ ok: true, message: newMsg });
  } catch (err) {
    console.error("[sync-together] chat error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

/* ──────────────────────────────────────────────
   GET /api/sync-together/:id/chat
   Fetch chat messages.
   ────────────────────────────────────────────── */
router.get("/:id/chat", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id)
      .select("chatMessages owner members")
      .populate("chatMessages.user", "username name avatar")
      .lean();

    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, userId))
      return res.status(403).json({ ok: false, error: "Not a group member" });

    // The chat page checks this every few seconds, so a request here means
    // they're reading the chat: don't notify them, and clear its bell entry.
    markViewing(group._id, userId);
    markGroupRead(req.app.get("io"), userId, group._id).catch(() => {});

    // ?after=<ISO time> returns only newer messages (the page checks every
    // few seconds, so this keeps each check tiny).
    const after = req.query.after ? new Date(req.query.after) : null;
    const all = group.chatMessages || [];
    const messages =
      after && !Number.isNaN(after.getTime())
        ? all.filter((m) => new Date(m.createdAt) > after)
        : all.slice(-200);
    return res.json({ ok: true, messages });
  } catch (err) {
    console.error("[sync-together] chat fetch error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to fetch messages" });
  }
});

/* ══════════════════════════════════════════════
   EVERYONE BOOKS THEIR OWN PART
   Plan together, pay separately: each traveler books their own seat
   and their own room (or a share of a shared room) and can cancel
   their own part from My Trips. Only the organizer can cancel a
   shared room.
   ══════════════════════════════════════════════ */

// Loads the group with the names/emails the trip-part tools need.
async function loadGroupForParts(id) {
  return SyncGroup.findById(id)
    .populate("owner", "username name email avatar")
    .populate("members.user", "username name email avatar");
}

function requireMember(group, userId, res) {
  if (!group) {
    res.status(404).json({ ok: false, error: "Group not found" });
    return false;
  }
  if (!isGroupMember(group, userId)) {
    res.status(403).json({ ok: false, error: "Not a group member" });
    return false;
  }
  return true;
}

const REMIND_EVERY_MS = 12 * 60 * 60 * 1000;

// Shortlist as the trip page shows it: most votes first, names attached.
function shortlistForClient(group, viewerId) {
  const people = new Map();
  if (group.owner?._id)
    people.set(
      String(group.owner._id),
      group.owner.name || group.owner.username
    );
  for (const m of group.members || []) {
    if (m.user?._id)
      people.set(String(m.user._id), m.user.name || m.user.username || m.name);
  }
  return (group.shortlist || [])
    .map((it) => {
      const votes = (it.votes || []).map(String);
      return {
        id: String(it._id),
        kind: it.kind,
        key: it.key,
        status: it.status,
        note: it.note,
        hotel: it.kind === "hotel" ? it.hotel : undefined,
        flight: it.kind === "flight" ? it.flight : undefined,
        activity: it.kind === "activity" ? it.activity : undefined,
        price: it.price,
        currency: it.currency,
        suggestedBy: people.get(String(it.suggestedBy)) || "Someone",
        suggestedByMe: String(it.suggestedBy) === String(viewerId),
        votes: votes.length,
        voters: votes.map((v) => people.get(v)).filter(Boolean),
        votedByMe: votes.includes(String(viewerId)),
        isGroupHotel:
          it.kind === "hotel" &&
          it.hotel?.hotelId &&
          it.hotel.hotelId === group.groupHotel?.hotelId,
        isGroupFlight: it.kind === "flight" && it.key === group.groupFlightKey,
        at: it.createdAt,
      };
    })
    .sort((a, b) => b.votes - a.votes || new Date(b.at) - new Date(a.at));
}

const cleanStr = (v, n = 200) =>
  v == null || v === "" ? undefined : String(v).trim().slice(0, n);
const cleanNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
const SHORTLIST_MAX = 30;

async function computeParts(group, viewerId) {
  const travelers = travelersOf(group);
  const userIds = travelers.map((t) => t.userId).filter(Boolean);

  const [bookings, rooms] = await Promise.all([
    Booking.find({
      user: { $in: userIds },
      $or: [{ syncGroup: group._id }, { "flight.groupId": String(group._id) }],
    })
      .select(
        "user type status tripDetails total totalAmount totalCurrency dates sharedRoom createdAt confirmationEmail syncGroup " +
          "flight.groupId flight.origin flight.destination flight.airline flight.departureAt flight.arrivalAt " +
          "flight.returnDepartureAt flight.returnArrivingAt"
      )
      .sort({ createdAt: -1 })
      .lean(),
    SplitPayment.find({ group: group._id, kind: "shared_room" }).sort({
      createdAt: -1,
    }),
  ]);

  const pickLatest = (list) =>
    list.find((b) => b.status !== "cancelled") || list[0] || null;
  const slim = (b) =>
    b && {
      id: String(b._id),
      status: b.status,
      tripDetails: b.tripDetails,
      total: b.totalAmount ?? b.total ?? null,
      currency: b.totalCurrency || "USD",
      // "sent" | "failed" | null (older bookings) — never the address itself
      emailStatus: b.confirmationEmail?.status || null,
      // Linked by hand from "Link a booking" — the owner can unlink it.
      // Bookings made through group checkout stay on the trip.
      removable: isHandLinked(b, group._id),
    };
  // Times are kept as the airline sends them (airport local time), so
  // compare the first 16 characters ("YYYY-MM-DDTHH:mm") as text.
  const localMinute = (v) => (v ? String(v).slice(0, 16) : null);
  const win = group.arrivalWindow || {};
  const flightInfo = (b) => {
    if (!b) return null;
    const f = b.flight || {};
    const arrivesAt = localMinute(f.arrivalAt);
    const outsideWindow =
      Boolean(
        arrivesAt && b.status !== "cancelled" && (win.start || win.end)
      ) &&
      ((win.start && arrivesAt < win.start) ||
        (win.end && arrivesAt > win.end));
    return {
      ...slim(b),
      origin: f.origin || null,
      destination: f.destination || null,
      airline: f.airline || null,
      departsAt: localMinute(f.departureAt),
      arrivesAt,
      returnDepartsAt: localMinute(f.returnDepartureAt),
      returnArrivesAt: localMinute(f.returnArrivingAt),
      outsideWindow: Boolean(outsideWindow),
    };
  };

  const activeRooms = rooms.filter((r) =>
    ["collecting", "booking", "booked"].includes(r.status)
  );

  const parts = travelers.map((t) => {
    const mine = bookings.filter(
      (b) => t.userId && String(b.user) === t.userId
    );
    const flight = pickLatest(mine.filter((b) => b.type === "Flight"));
    const ownStay = pickLatest(
      mine.filter((b) => b.type === "Hotel" && !b.sharedRoom)
    );
    const room = activeRooms.find((r) =>
      r.shares.some((s) => String(s.user) === t.userId)
    );
    const share = room?.shares.find((s) => String(s.user) === t.userId);

    let stay = null;
    if (room) {
      const rec = share?.booking
        ? mine.find((b) => String(b._id) === String(share.booking))
        : null;
      stay = {
        kind: "shared",
        sharedRoomId: String(room._id),
        roomStatus: room.status,
        shareStatus: share?.status,
        hotel: room.room?.name,
        id: rec ? String(rec._id) : null,
        emailStatus: rec?.confirmationEmail?.status || null,
      };
    } else if (ownStay) {
      stay = { kind: "own", ...slim(ownStay) };
    }

    const flightDone = flight && flight.status !== "cancelled";
    const stayDone =
      (stay?.kind === "own" && stay.status !== "cancelled") ||
      (stay?.kind === "shared" &&
        ["authorized", "paid"].includes(stay.shareStatus));
    const needs = [];
    if (t.rsvp === "pending" && !t.isOrganizer)
      needs.push("Say whether you're coming");
    if (!flightDone) needs.push("Book your flight");
    if (!stayDone)
      needs.push(
        stay?.kind === "shared"
          ? "Hold your share of the room"
          : "Book your room (or join a shared room)"
      );

    return {
      ...t,
      email: undefined, // never sent to other travelers
      isYou: t.userId && String(t.userId) === String(viewerId),
      flight: flightInfo(flight),
      stay,
      needs,
      done: needs.length === 0,
      canRemind:
        !t.isOrganizer &&
        needs.length > 0 &&
        (!t.lastRemindedAt ||
          Date.now() - new Date(t.lastRemindedAt).getTime() > REMIND_EVERY_MS),
    };
  });

  return {
    holdHours: HOLD_HOURS,
    allBookedAt: group.allBookedAt || null,
    bookingOpenedAt: group.bookingOpenedAt || null,
    groupHotel: group.groupHotel?.hotelId ? group.groupHotel : null,
    groupFlightKey: group.groupFlightKey || null,
    budgetSummary: budgetSummaryFor(group),
    shortlist: shortlistForClient(group, viewerId),
    cabinClass: group.cabinClass || "economy",
    status: group.status,
    hasPlan: Boolean(group.plan),
    destination: group.destination || null,
    dateRangeStart: group.dateRangeStart || null,
    dateRangeEnd: group.dateRangeEnd || null,
    arrivalWindow: {
      start: win.start || null,
      end: win.end || null,
      note: win.note || null,
    },
    declined: (group.members || [])
      .filter((m) => m.status === "declined")
      .map((m) => ({
        memberId: String(m._id),
        name:
          m.user?.name || m.user?.username || m.name || m.email || "Traveler",
      })),
    travelers: parts,
    sharedRooms: rooms.map((r) => sharedRoomForClient(r, viewerId)),
  };
}

/* GET /api/sync-together/:id/parts — the status board */
router.get("/:id/parts", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    // Catch any room whose deadline passed since the job last ran.
    await expireDueSharedRooms({ group: req.params.id }).catch(() => {});
    const group = await loadGroupForParts(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const parts = await computeParts(group, userId);
    return res.json({
      ok: true,
      isOrganizer: isOrganizer(group, userId),
      ...parts,
    });
  } catch (err) {
    return sendSyncError(res, err, "Failed to load trip parts");
  }
});

/* POST /api/sync-together/:id/remind  { memberId } — organizer only */
router.post("/:id/remind", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await loadGroupForParts(req.params.id);
    if (!requireMember(group, userId, res)) return;
    if (!isOrganizer(group, userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only the organizer can send reminders" });
    }
    const member = validId(req.body?.memberId)
      ? group.members.id(req.body.memberId)
      : null;
    if (!member)
      return res.status(404).json({ ok: false, error: "Traveler not found" });
    if (
      member.lastRemindedAt &&
      Date.now() - member.lastRemindedAt.getTime() < REMIND_EVERY_MS
    ) {
      return res.status(429).json({
        ok: false,
        error: "You already reminded them recently. Try again later.",
      });
    }
    const parts = await computeParts(group, userId);
    const part = parts.travelers.find((t) => t.memberId === String(member._id));
    if (!part?.needs?.length) {
      return res.status(400).json({
        ok: false,
        error: "They're all set — nothing to remind them about.",
      });
    }
    const to = member.email || member.user?.email;
    if (!to)
      return res.status(400).json({
        ok: false,
        error: "We don't have an email for this traveler.",
      });

    const result = await sendGroupReminder({
      to,
      name: member.user?.name || member.name,
      organizerName: group.owner?.name || group.owner?.username,
      tripTitle: group.title,
      destination: group.destination,
      groupId: group._id,
      needs: part.needs,
    });
    if (!result?.ok) {
      return res.status(502).json({
        ok: false,
        error: "The reminder email didn't send. Try again in a bit.",
      });
    }
    member.lastRemindedAt = new Date();
    logActivity(
      group,
      "reminder_sent",
      userId,
      `Sent ${member.user?.name || member.name || "a traveler"} a reminder`
    );
    await group.save();
    return res.json({ ok: true });
  } catch (err) {
    return sendSyncError(res, err, "Failed to send reminder");
  }
});

/* ══════════════════════════════════════════════
   GROUP SHORTLIST — suggest → vote → pick
   ══════════════════════════════════════════════ */

/* POST /api/sync-together/:id/shortlist
   Body: { kind: "hotel"|"flight", note?, price?, currency?, hotel?: {...}, flight?: {...} } */
router.post("/:id/shortlist", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await loadGroupForParts(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const kind = req.body?.kind;
    if (!["hotel", "flight", "activity"].includes(kind)) {
      return res
        .status(400)
        .json({ ok: false, error: "Suggest a flight, a stay or an activity." });
    }

    let item;
    if (kind === "hotel") {
      const h = req.body.hotel || {};
      if (!h.hotelId)
        return res
          .status(400)
          .json({ ok: false, error: "Pick a hotel from the search results." });
      item = {
        kind,
        key: `hotel:${String(h.hotelId).slice(0, 64)}`,
        hotel: {
          hotelId: cleanStr(h.hotelId, 64),
          name: cleanStr(h.name),
          address: cleanStr(h.address, 300),
          thumbnail: /^https:\/\//.test(String(h.thumbnail || ""))
            ? cleanStr(h.thumbnail, 600)
            : undefined,
          stars: cleanNum(h.stars),
          rating: cleanNum(h.rating),
          roomName: cleanStr(h.roomName),
          boardName: cleanStr(h.boardName, 100),
          checkin: cleanStr(h.checkin, 10),
          checkout: cleanStr(h.checkout, 10),
          adults: cleanNum(h.adults),
        },
      };
    } else if (kind === "activity") {
      const a = req.body.activity || {};
      if (!a.name || !(a.id || a.url))
        return res
          .status(400)
          .json({ ok: false, error: "Pick an activity from the results." });
      const safeUrl = /^https:\/\//.test(String(a.url || ""))
        ? cleanStr(a.url, 600)
        : undefined;
      item = {
        kind,
        key: `activity:${String(a.id || a.url).slice(0, 120)}`,
        activity: {
          id: cleanStr(a.id, 120),
          name: cleanStr(a.name, 200),
          image: /^https:\/\//.test(String(a.image || ""))
            ? cleanStr(a.image, 600)
            : undefined,
          city: cleanStr(a.city, 120),
          duration: cleanStr(a.duration, 60),
          rating: cleanNum(a.rating),
          reviews: cleanNum(a.reviews),
          url: safeUrl,
        },
      };
    } else {
      const f = req.body.flight || {};
      if (!f.origin || !f.destination || !f.departAt) {
        return res
          .status(400)
          .json({ ok: false, error: "Pick a flight from the search results." });
      }
      const key = [
        "flight",
        f.airlineCode || f.airline,
        f.origin,
        f.destination,
        f.departAt,
        f.returnDepartAt || "",
      ]
        .map((x) => String(x || "").slice(0, 40))
        .join(":");
      item = {
        kind,
        key,
        flight: {
          airline: cleanStr(f.airline, 80),
          airlineCode: cleanStr(f.airlineCode, 8),
          logo: /^https:\/\//.test(String(f.logo || ""))
            ? cleanStr(f.logo, 600)
            : undefined,
          origin: cleanStr(f.origin, 8),
          destination: cleanStr(f.destination, 8),
          departAt: cleanStr(f.departAt, 40),
          arriveAt: cleanStr(f.arriveAt, 40),
          returnDepartAt: cleanStr(f.returnDepartAt, 40),
          returnArriveAt: cleanStr(f.returnArriveAt, 40),
          stops: cleanNum(f.stops),
          cabin: cleanStr(f.cabin, 20),
        },
      };
    }

    const existing = group.shortlist.find((s) => s.key === item.key);
    if (existing) {
      // Suggesting something already on the list counts as a vote.
      if (!existing.votes.map(String).includes(String(userId)))
        existing.votes.push(userId);
      await group.save();
      return res.json({
        ok: true,
        alreadyListed: true,
        itemId: String(existing._id),
      });
    }
    if (
      group.shortlist.filter((s) => s.status === "open").length >= SHORTLIST_MAX
    ) {
      return res.status(409).json({
        ok: false,
        error: "The shortlist is full. Remove a few options first.",
      });
    }

    group.shortlist.push({
      ...item,
      suggestedBy: userId,
      note: cleanStr(req.body?.note, 200) || "",
      votes: [userId], // suggesting = your vote
      price: cleanNum(req.body?.price) ?? null,
      currency: cleanStr(req.body?.currency, 3) || "USD",
    });
    const added = group.shortlist[group.shortlist.length - 1];
    const label =
      kind === "hotel"
        ? item.hotel.name || "a hotel"
        : kind === "activity"
        ? item.activity.name || "an activity"
        : `${item.flight.airline || "a flight"} ${item.flight.origin}→${
            item.flight.destination
          }`;
    const who = req.user?.name || req.user?.username || "Someone";
    logActivity(group, "shortlist_add", userId, `Suggested ${label}`);
    await group.save();

    const others = [
      group.owner?._id,
      ...group.members
        .filter((m) => m.user && m.status !== "declined")
        .map((m) => m.user._id),
    ].filter((id) => id && String(id) !== String(userId));
    Notification.insertMany(
      others.map((u) => ({
        user: u,
        type: "booking",
        title: `New ${kind === "activity" ? "activity" : kind} suggestion 🗳️`,
        message: `${label} was added to the ${
          group.title || "trip"
        } shortlist. Vote for your favorite.`,
        link: `/sync-together/${group._id}`,
      }))
    ).catch(() => {});

    return res.status(201).json({ ok: true, itemId: String(added._id) });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't add that to the shortlist");
  }
});

/* POST /api/sync-together/:id/shortlist/:itemId/vote — toggles your vote */
router.post("/:id/shortlist/:itemId/vote", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const it = validId(req.params.itemId)
      ? group.shortlist.id(req.params.itemId)
      : null;
    if (!it)
      return res.status(404).json({
        ok: false,
        error: "That option isn't on the shortlist anymore.",
      });
    const voted = it.votes.map(String).includes(String(userId));
    if (voted) it.votes = it.votes.filter((v) => String(v) !== String(userId));
    else it.votes.push(userId);
    await group.save();
    return res.json({ ok: true, voted: !voted, votes: it.votes.length });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't save your vote");
  }
});

/* DELETE /api/sync-together/:id/shortlist/:itemId — the person who suggested it, or the organizer */
router.delete("/:id/shortlist/:itemId", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const it = validId(req.params.itemId)
      ? group.shortlist.id(req.params.itemId)
      : null;
    if (!it) return res.json({ ok: true });
    if (
      String(it.suggestedBy) !== String(userId) &&
      !isOrganizer(group, userId)
    ) {
      return res.status(403).json({
        ok: false,
        error:
          "Only the person who suggested it or the organizer can remove it.",
      });
    }
    if (it.key === group.groupFlightKey) group.groupFlightKey = null;
    it.deleteOne();
    await group.save();
    return res.json({ ok: true });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't remove that option");
  }
});

/* POST /api/sync-together/:id/shortlist/:itemId/pick — organizer picks the winner.
   Hotel → becomes the group's hotel (everyone's "Book my room here" opens it).
   Flight → marked as the group's flight. */
router.post("/:id/shortlist/:itemId/pick", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await loadGroupForParts(req.params.id);
    if (!requireMember(group, userId, res)) return;
    if (!isOrganizer(group, userId))
      return res
        .status(403)
        .json({ ok: false, error: "Only the organizer can pick the winner." });
    const it = validId(req.params.itemId)
      ? group.shortlist.id(req.params.itemId)
      : null;
    if (!it)
      return res.status(404).json({
        ok: false,
        error: "That option isn't on the shortlist anymore.",
      });

    if (it.kind !== "activity") {
      group.shortlist.forEach((s) => {
        if (s.kind === it.kind) s.status = "open";
      });
    }
    it.status = "picked";
    let label;
    if (it.kind === "hotel") {
      group.groupHotel = {
        hotelId: it.hotel.hotelId,
        name: it.hotel.name,
        address: it.hotel.address,
        thumbnail: it.hotel.thumbnail,
        stars: it.hotel.stars,
        rating: it.hotel.rating,
        setAt: new Date(),
      };
      label = it.hotel.name || "the hotel";
    } else if (it.kind === "activity") {
      // Activities: several can be picked (it's a list of things to do).
      it.status = "picked";
      label = it.activity?.name || "the activity";
    } else {
      group.groupFlightKey = it.key;
      label = `${it.flight.airline || "the flight"} ${it.flight.origin}→${
        it.flight.destination
      }`;
    }
    logActivity(
      group,
      "shortlist_pick",
      userId,
      `Picked ${label} for the group`
    );
    await group.save();

    const others = group.members
      .filter((m) => m.user && m.status !== "declined")
      .map((m) => m.user._id);
    Notification.insertMany(
      others.map((u) => ({
        user: u,
        type: "booking",
        title:
          it.kind === "hotel"
            ? "The group's hotel is picked 🏨"
            : it.kind === "activity"
            ? "Added to the plan 🎟️"
            : "The group's flight is picked ✈️",
        message: `${label} won. Book your part from the trip page.`,
        link: `/sync-together/${group._id}`,
      }))
    ).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't pick that option");
  }
});

/* POST /api/sync-together/:id/resend-confirmation  { bookingId }
   Resends the confirmation email for a booking on this trip. You can
   resend your own; the organizer can resend anyone's (it goes to that
   traveler's own email). Once every 10 minutes per booking. */
router.post("/:id/resend-confirmation", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const bookingId = req.body?.bookingId;
    if (!validId(bookingId))
      return res
        .status(400)
        .json({ ok: false, error: "Pick a booking to resend." });
    const booking = await Booking.findById(bookingId);
    const onTrip =
      booking &&
      (String(booking.syncGroup) === String(group._id) ||
        String(booking.flight?.groupId) === String(group._id));
    if (!onTrip)
      return res
        .status(404)
        .json({ ok: false, error: "That booking isn't on this trip." });
    if (
      String(booking.user) !== String(userId) &&
      !isOrganizer(group, userId)
    ) {
      return res.status(403).json({
        ok: false,
        error: "You can only resend your own confirmation.",
      });
    }
    const last = booking.confirmationEmail?.at
      ? new Date(booking.confirmationEmail.at).getTime()
      : 0;
    if (
      booking.confirmationEmail?.status === "sent" &&
      Date.now() - last < 10 * 60 * 1000
    ) {
      return res.status(429).json({
        ok: false,
        error:
          "We just sent it. Check spam or promotions, or try again in a few minutes.",
      });
    }
    const result = await sendConfirmationFor(booking);
    if (!result?.ok) {
      return res.status(502).json({
        ok: false,
        error: "The email didn't send. Try again shortly, or contact support.",
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't resend the confirmation");
  }
});

/* PUT /api/sync-together/:id/group-hotel — organizer only
   Body: { hotel: { hotelId, name, address, thumbnail, stars, rating } }
   or { hotel: null } to clear. Everyone's "Book my room" then opens this
   hotel's rooms, so the group stays together. */
router.put("/:id/group-hotel", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    if (!isOrganizer(group, userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can pick the group's hotel.",
      });
    }
    const h = req.body?.hotel;
    if (h && !h.hotelId)
      return res
        .status(400)
        .json({ ok: false, error: "Pick a hotel from the search results." });
    const str = (v, n = 300) => (v == null ? null : String(v).slice(0, n));
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    group.groupHotel = h
      ? {
          hotelId: str(h.hotelId, 64),
          name: str(h.name, 200),
          address: str(h.address),
          thumbnail: /^https:\/\//.test(String(h.thumbnail || ""))
            ? str(h.thumbnail, 600)
            : null,
          stars: num(h.stars),
          rating: num(h.rating),
          setAt: new Date(),
        }
      : {
          hotelId: null,
          name: null,
          address: null,
          thumbnail: null,
          stars: null,
          rating: null,
          setAt: null,
        };
    logActivity(
      group,
      "group_hotel",
      userId,
      h
        ? `Picked ${h.name || "a hotel"} for the group`
        : "Cleared the group's hotel"
    );
    await group.save();
    if (h) {
      const others = group.members
        .filter((m) => m.user && m.status !== "declined")
        .map((m) => m.user);
      Notification.insertMany(
        others.map((u) => ({
          user: u,
          type: "booking",
          title: "The group's hotel is picked 🏨",
          message: `Everyone's staying at ${
            h.name || "the group's hotel"
          }. Book your room from the trip page.`,
          link: `/sync-together/${group._id}`,
        }))
      ).catch(() => {});
    }
    return res.json({
      ok: true,
      groupHotel: group.groupHotel?.hotelId ? group.groupHotel : null,
    });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't save the group's hotel");
  }
});

/* POST /api/sync-together/:id/start-booking — organizer only.
   For groups that already know what they want: skip the Atlas plan and
   approvals and go straight to everyone booking their own part. */
router.post("/:id/start-booking", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    if (!isOrganizer(group, userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only the organizer can start booking." });
    }
    if (!group.destination) {
      return res.status(400).json({
        ok: false,
        error: "Set a destination first so everyone searches the same place.",
      });
    }
    if (!["booked", "completed", "cancelled"].includes(group.status))
      group.status = "confirmed";
    group.bookingOpenedAt = group.bookingOpenedAt || new Date();
    logActivity(
      group,
      "start_booking",
      userId,
      "Opened booking — everyone can book their own part"
    );
    await group.save();
    const populated = await fullPopulate(SyncGroup.findById(group._id)).lean();
    return res.json({ ok: true, group: populated });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't start booking");
  }
});

/* POST /api/sync-together/:id/rsvp  { going: true|false }
   An invited traveler says whether they're coming. Declining releases
   any shared room still collecting holds that includes them. They can
   change their answer later. */
router.post("/:id/rsvp", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: isOrganizer(group, userId)
          ? "You're the organizer — you're already going."
          : "Not a group member",
      });
    }
    if (typeof req.body?.going !== "boolean") {
      return res
        .status(400)
        .json({ ok: false, error: "Send going: true or false" });
    }
    const going = req.body.going;
    const next = going ? "accepted" : "declined";
    if (member.status !== next) {
      member.status = next;
      if (going) member.joinedAt = member.joinedAt || new Date();
      else {
        member.approved = false;
        member.approvedAt = null;
        await releaseRoomsForUser(group._id, userId);
      }
      const who = member.name || "A traveler";
      logActivity(
        group,
        going ? "rsvp_yes" : "rsvp_no",
        userId,
        going ? `${who} is going` : `${who} can't make it`
      );
      await group.save();
      Notification.create({
        user: group.owner,
        type: "booking",
        title: going ? "Someone's in 🎉" : "Someone can't make it",
        message: `${who} ${going ? "is going on" : "can't make it to"} ${
          group.title || "your trip"
        }.`,
        link: `/sync-together/${group._id}`,
      }).catch(() => {});
    }
    const populated = await fullPopulate(SyncGroup.findById(group._id)).lean();
    return res.json({ ok: true, group: populated });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't save your answer");
  }
});

/* PATCH /api/sync-together/:id/my-budget  { budget: number | null }
   Your own budget per person. Only you see it; the group sees only the
   comfort level (everyone's comfortable up to about $X). */
router.patch("/:id/my-budget", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const raw = req.body?.budget;
    const budget = raw === null || raw === "" ? null : Number(raw);
    if (
      budget !== null &&
      (!Number.isFinite(budget) || budget < 0 || budget > 1000000)
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Enter a budget in dollars." });
    }
    if (String(group.owner) === String(userId)) {
      group.ownerBudget = budget ? Math.round(budget) : null;
    } else {
      const m = group.members.find(
        (x) => x.user && String(x.user) === String(userId)
      );
      if (!m)
        return res.status(403).json({ ok: false, error: "Not a group member" });
      m.budget = budget ? Math.round(budget) : null;
    }
    await group.save();
    return res.json({
      ok: true,
      myBudget: budget ? Math.round(budget) : null,
      budgetSummary: budgetSummaryFor(group),
    });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't save your budget");
  }
});

/* PATCH /api/sync-together/:id/arrival-window — organizer only
   Body: { start: "YYYY-MM-DDTHH:mm" | null, end: … | null, note? }
   Times are destination local time. Send nulls to clear. */
const LOCAL_MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
router.patch("/:id/arrival-window", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isOrganizer(group, userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can set the arrival window",
      });
    }
    const start = req.body?.start || null;
    const end = req.body?.end || null;
    if (
      (start && !LOCAL_MINUTE.test(start)) ||
      (end && !LOCAL_MINUTE.test(end))
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Use a date and time for the window." });
    }
    if (start && end && start > end) {
      return res
        .status(400)
        .json({ ok: false, error: "The window has to end after it starts." });
    }
    group.arrivalWindow = {
      start,
      end,
      note: req.body?.note ? String(req.body.note).trim().slice(0, 200) : null,
    };
    logActivity(
      group,
      "arrival_window",
      userId,
      start || end ? "Set the arrival window" : "Cleared the arrival window"
    );
    await group.save();
    return res.json({ ok: true, arrivalWindow: group.arrivalWindow });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't save the arrival window");
  }
});

/* POST /api/sync-together/:id/shared-rooms
   Body: { room: {hotelId, offerId, name, roomName, boardName, address,
                  thumbnail, checkin, checkout, adults},
           userIds: [...], holder: {firstName, lastName, email} }
   Organizer only. Checks the price with the hotel and starts collecting holds. */
router.post("/:id/shared-rooms", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await loadGroupForParts(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const split = await createSharedRoom({
      group,
      actorUserId: userId,
      room: req.body?.room,
      userIds: req.body?.userIds,
      holder: req.body?.holder,
    });
    return res
      .status(201)
      .json({ ok: true, sharedRoom: sharedRoomForClient(split, userId) });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't set up the shared room");
  }
});

async function loadRoomForGroup(req, res) {
  const userId = req.user?.id ?? req.user?._id;
  if (!validId(req.params.splitId)) {
    res.status(404).json({ ok: false, error: "Shared room not found" });
    return null;
  }
  const group = await loadGroupForParts(req.params.id);
  if (!requireMember(group, userId, res)) return null;
  const split = await SplitPayment.findOne({
    _id: req.params.splitId,
    group: group._id,
    kind: "shared_room",
  });
  if (!split) {
    res.status(404).json({ ok: false, error: "Shared room not found" });
    return null;
  }
  return { group, split, userId };
}

/* POST /:id/shared-rooms/:splitId/shares/:shareId/hold
   Starts (or resumes) the card hold for YOUR share. Returns a clientSecret. */
router.post(
  "/:id/shared-rooms/:splitId/shares/:shareId/hold",
  async (req, res) => {
    try {
      const ctx = await loadRoomForGroup(req, res);
      if (!ctx) return;
      const out = await startShareHold({
        splitId: ctx.split._id,
        shareId: req.params.shareId,
        userId: ctx.userId,
      });
      return res.json({ ok: true, ...out });
    } catch (err) {
      return sendSyncError(res, err, "Couldn't start your card hold");
    }
  }
);

/* POST /:id/shared-rooms/:splitId/shares/:shareId/held
   Called right after the card is authorized; verified with Stripe. */
router.post(
  "/:id/shared-rooms/:splitId/shares/:shareId/held",
  async (req, res) => {
    try {
      const ctx = await loadRoomForGroup(req, res);
      if (!ctx) return;
      await confirmShareHold({
        splitId: ctx.split._id,
        shareId: req.params.shareId,
        userId: ctx.userId,
      });
      const fresh = await SplitPayment.findById(ctx.split._id);
      return res.json({
        ok: true,
        sharedRoom: sharedRoomForClient(fresh, ctx.userId),
      });
    } catch (err) {
      return sendSyncError(res, err, "Couldn't confirm your card hold");
    }
  }
);

/* POST /:id/shared-rooms/:splitId/release — organizer only.
   Lets every hold go; nobody is charged. */
router.post("/:id/shared-rooms/:splitId/release", async (req, res) => {
  try {
    const ctx = await loadRoomForGroup(req, res);
    if (!ctx) return;
    if (!isOrganizer(ctx.group, ctx.userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can release a shared room",
      });
    }
    if (ctx.split.status !== "collecting") {
      return res.status(409).json({
        ok: false,
        error: "This room isn't collecting holds anymore.",
      });
    }
    await releaseSharedRoom(ctx.split._id, "released");
    return res.json({ ok: true });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't release the room");
  }
});

/* GET /:id/shared-rooms/:splitId/cancel-quote — organizer only */
router.get("/:id/shared-rooms/:splitId/cancel-quote", async (req, res) => {
  try {
    const ctx = await loadRoomForGroup(req, res);
    if (!ctx) return;
    if (!isOrganizer(ctx.group, ctx.userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can cancel a shared room",
      });
    }
    const quote = await sharedRoomCancelQuote(ctx.split);
    return res.json({ ok: true, quote });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't get the cancellation terms");
  }
});

/* POST /:id/shared-rooms/:splitId/cancel — organizer only.
   Cancels with the hotel, then refunds each person their share of the
   hotel's refund. */
router.post("/:id/shared-rooms/:splitId/cancel", async (req, res) => {
  try {
    const ctx = await loadRoomForGroup(req, res);
    if (!ctx) return;
    if (!isOrganizer(ctx.group, ctx.userId)) {
      return res.status(403).json({
        ok: false,
        error: "Only the organizer can cancel a shared room",
      });
    }
    const out = await cancelSharedRoom({
      split: ctx.split,
      actorUserId: ctx.userId,
      actorName: ctx.group.owner?.name || ctx.group.owner?.username,
    });
    return res.json({ ok: true, ...out });
  } catch (err) {
    return sendSyncError(res, err, "Cancellation failed");
  }
});

/* ══════════════════════════════════════════════
   BOOKING PROGRESS + ADDING BOOKINGS TO A TRIP
   A booking only counts toward a trip when it is linked to that trip
   (booking.syncGroup, or flight.groupId set by group checkout). Nothing
   is ever matched by destination or dates, so personal trips stay
   private unless the traveler adds them on purpose.
   ══════════════════════════════════════════════ */

// Everyone going on the trip: the organizer plus every member who
// hasn't declined. null = invited by email, no account yet (still a
// traveler, just can't book until they sign up).
function goingTravelerIds(group) {
  const ids = [String(group.owner?._id || group.owner)];
  for (const m of group.members || []) {
    if (m.status === "declined") continue;
    ids.push(m.user ? String(m.user._id || m.user) : null);
  }
  return ids;
}

// Mongo filter for bookings that belong to this trip.
function linkedToGroup(groupId) {
  return {
    $or: [{ syncGroup: groupId }, { "flight.groupId": String(groupId) }],
  };
}

// True when the traveler added this booking to the trip themselves.
// Group-checkout flights carry flight.groupId; clearing syncGroup alone
// wouldn't take those off, so they aren't offered an Unlink.
function isHandLinked(b, groupId) {
  return String(b.syncGroup || "") === String(groupId) && !b.flight?.groupId;
}

// Words/codes that identify where this trip is going: the trip's
// destination text, plus the arrival airport of any flight already on
// the trip (so "Miami" also matches MIA once someone has booked).
function tripPlaceTokens(group, linkedFlights = []) {
  const tokens = new Set();
  String(group.destination || "")
    .split(/[^A-Za-z]+/)
    .filter((w) => w.length >= 3)
    .forEach((w) => tokens.add(w.toUpperCase()));
  linkedFlights.forEach((f) => {
    const code = f.flight?.destination;
    if (code) tokens.add(String(code).toUpperCase());
  });
  return tokens;
}

// Does this booking go where the trip goes? null = can't tell (no
// destination set and nothing booked yet), treated as a match.
function goesToTrip(b, tokens) {
  if (!tokens.size) return null;
  if (b.type === "Flight") {
    const code = String(b.flight?.destination || "").toUpperCase();
    if (code && tokens.has(code)) return true;
  }
  const text = [b.tripDetails, b.hotel?.city, b.hotel?.address, b.hotel?.name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return [...tokens].some((t) => t.length > 3 && text.includes(t));
}

// What the trip page needs for the stepper and the status badge.
async function bookingProgressFor(group) {
  const ids = goingTravelerIds(group);
  const userIds = ids.filter(Boolean);
  const bookings = await Booking.find({
    user: { $in: userIds },
    status: "confirmed",
    ...linkedToGroup(group._id),
  })
    .select("user type")
    .lean();

  const withFlight = new Set();
  const withStay = new Set();
  for (const b of bookings) {
    if (b.type === "Flight") withFlight.add(String(b.user));
    if (b.type === "Hotel") withStay.add(String(b.user));
  }
  const bookedCount = userIds.filter(
    (u) => withFlight.has(u) || withStay.has(u)
  ).length;
  const fullyBooked = userIds.filter(
    (u) => withFlight.has(u) && withStay.has(u)
  ).length;
  const travelers = ids.length;

  return {
    travelers,
    flightsBooked: withFlight.size,
    staysBooked: withStay.size,
    bookedCount, // travelers with at least one part booked
    anyBooked: bookedCount > 0,
    // Same rule as the trip panel: done = a flight AND a room.
    allBooked: travelers > 0 && fullyBooked === travelers,
  };
}

/* GET /api/sync-together/:id/progress */
router.get("/:id/progress", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id).lean();
    if (!requireMember(group, userId, res)) return;
    return res.json({ ok: true, progress: await bookingProgressFor(group) });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't load booking progress");
  }
});

/* GET /api/sync-together/:id/attachable-bookings
   Only YOUR bookings. `available` = confirmed, upcoming, not on any trip.
   `onThisTrip` = ones linked to this trip (so you can take one off). */
router.get("/:id/attachable-bookings", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id).lean();
    if (!requireMember(group, userId, res)) return;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [available, onThisTrip, tripFlights] = await Promise.all([
      Booking.find({
        user: userId,
        status: "confirmed",
        type: { $in: ["Flight", "Hotel"] },
        syncGroup: null,
        sharedRoom: { $exists: false },
        "flight.groupId": { $in: [null, ""] },
        "dates.start": { $gte: yesterday },
      })
        .sort({ "dates.start": 1 })
        .limit(20)
        .lean(),
      Booking.find({
        user: userId,
        status: "confirmed",
        sharedRoom: { $exists: false },
        ...linkedToGroup(group._id),
      })
        .sort({ "dates.start": 1 })
        .lean(),
      // Anyone's flights on this trip — tells us the destination airport.
      Booking.find({
        type: "Flight",
        status: { $ne: "cancelled" },
        ...linkedToGroup(group._id),
      })
        .select("flight.destination")
        .limit(20)
        .lean(),
    ]);
    const places = tripPlaceTokens(group, tripFlights);
    const localMinute = (v) => (v ? String(v).slice(0, 16) : null);

    // Hints only. Never used to link anything.
    const DAY = 24 * 60 * 60 * 1000;
    const tripStart = group.dateRangeStart
      ? new Date(group.dateRangeStart).getTime() - 2 * DAY
      : null;
    const tripEnd = group.dateRangeEnd
      ? new Date(group.dateRangeEnd).getTime() + 2 * DAY
      : null;
    const slim = (b) => {
      const start = b.dates?.start ? new Date(b.dates.start).getTime() : null;
      const datesMatch = Boolean(
        start && tripStart && tripEnd && start >= tripStart && start <= tripEnd
      );
      const placeMatch = goesToTrip(b, places);
      return {
        id: String(b._id),
        type: b.type,
        tripDetails: b.tripDetails,
        start: b.dates?.start || null,
        end: b.dates?.end || null,
        airline: b.flight?.airline || null,
        // Flight times as the airline sends them (airport local time) —
        // the same source the trip page uses, so dates always agree.
        origin: b.flight?.origin || null,
        destination: b.flight?.destination || null,
        departsAt: localMinute(b.flight?.departureAt),
        returnDepartsAt: localMinute(b.flight?.returnDepartureAt),
        confirmation: b.confirmationCodes?.[0] || null,
        // Bookings linked by group checkout can't be taken off here.
        removable: isHandLinked(b, group._id),
        datesMatch,
        // Suggest only when it's the right place AND the right dates.
        suggested: datesMatch && placeMatch !== false,
      };
    };
    const list = available
      .map(slim)
      .sort((a, b) => Number(b.suggested) - Number(a.suggested));
    return res.json({
      ok: true,
      available: list,
      onThisTrip: onThisTrip.map(slim),
    });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't load your bookings");
  }
});

/* POST /api/sync-together/:id/attach-booking  { bookingId }
   Adds one of YOUR confirmed bookings to this trip. */
router.post("/:id/attach-booking", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;
    const me = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );
    if (me?.status === "declined") {
      return res.status(400).json({
        ok: false,
        error: "You said you can't make it. Tap “I'm in” first.",
      });
    }

    const { bookingId } = req.body || {};
    const booking = validId(bookingId)
      ? await Booking.findById(bookingId)
      : null;
    if (!booking || String(booking.user) !== String(userId)) {
      return res.status(404).json({
        ok: false,
        error: "We couldn't find that booking on your account.",
      });
    }
    if (booking.status !== "confirmed") {
      return res.status(400).json({
        ok: false,
        error: "Only confirmed bookings can be added to a trip.",
      });
    }
    if (!["Flight", "Hotel"].includes(booking.type) || booking.sharedRoom) {
      return res.status(400).json({
        ok: false,
        error: "Only your own flight or room can be added.",
      });
    }
    const linkedTo = booking.syncGroup || booking.flight?.groupId;
    if (linkedTo && String(linkedTo) !== String(group._id)) {
      return res.status(409).json({
        ok: false,
        error: "That booking is already on another group trip.",
      });
    }

    if (!booking.syncGroup) {
      booking.syncGroup = group._id;
      await booking.save();
      const what = booking.type === "Flight" ? "flight" : "room";
      logActivity(
        group,
        "booked",
        userId,
        `added their ${what} to the trip (${String(
          booking.tripDetails || ""
        ).slice(0, 80)})`
      );
      await group.save();
    }
    return res.json({ ok: true, progress: await bookingProgressFor(group) });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't add that booking");
  }
});

/* POST /api/sync-together/:id/detach-booking  { bookingId }
   Takes one of YOUR bookings off this trip. The booking itself is not
   cancelled; it just stops showing on the group's page. */
router.post("/:id/detach-booking", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!requireMember(group, userId, res)) return;

    const { bookingId } = req.body || {};
    const booking = validId(bookingId)
      ? await Booking.findById(bookingId)
      : null;
    if (!booking || String(booking.user) !== String(userId)) {
      return res.status(404).json({
        ok: false,
        error: "We couldn't find that booking on your account.",
      });
    }
    if (!isHandLinked(booking, group._id)) {
      return res.status(400).json({
        ok: false,
        error: "That booking isn't one you added to this trip.",
      });
    }
    if (booking.sharedRoom) {
      return res.status(400).json({
        ok: false,
        error: "Shared rooms are managed by the organizer on the trip page.",
      });
    }

    booking.syncGroup = null;
    await booking.save();
    const what = booking.type === "Flight" ? "flight" : "room";
    logActivity(
      group,
      "booking_removed",
      userId,
      `took their ${what} off the trip`
    );
    await group.save();
    return res.json({ ok: true, progress: await bookingProgressFor(group) });
  } catch (err) {
    return sendSyncError(res, err, "Couldn't take that booking off the trip");
  }
});

export default router;
