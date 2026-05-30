import { Router } from "express";
import User from "../../models/user.js";
import SyncGroup from "../../models/SyncGroup.js";
import { auth as authRequired } from "../../middleware/auth.js";

const router = Router();
router.use(authRequired);

/* ── Helper: check if user is owner or member ── */
function isGroupMember(group, userId) {
  if (String(group.owner._id || group.owner) === String(userId)) return true;
  return group.members.some(
    (m) => m.user && String(m.user._id || m.user) === String(userId)
  );
}

/* ──────────────────────────────────────────────
   GET /api/sync-together/search?q=john
   ────────────────────────────────────────────── */
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ ok: true, users: [] });

    const regex = new RegExp(q.trim(), "i");
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
   POST /api/sync-together
   Create a new SyncGroup.
   ────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const ownerId = req.user?.id ?? req.user?._id;
    if (!ownerId)
      return res.status(401).json({ ok: false, error: "Not authenticated" });

    const { members = [], title } = req.body;
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
      members: memberDocs,
      status: "inviting",
    });

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
    const group = await SyncGroup.findById(req.params.id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });

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

    if (!isGroupMember(group, userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only group members can edit" });
    }

    const {
      title,
      destination,
      departureAirport,
      cabinClass,
      dateRangeStart,
      dateRangeEnd,
      budget,
      status,
    } = req.body;

    if (title !== undefined) group.title = title;
    if (destination !== undefined) group.destination = destination;
    if (departureAirport !== undefined)
      group.departureAirport = departureAirport;
    if (cabinClass !== undefined) group.cabinClass = cabinClass;
    if (dateRangeStart !== undefined) group.dateRangeStart = dateRangeStart;
    if (dateRangeEnd !== undefined) group.dateRangeEnd = dateRangeEnd;
    if (status !== undefined) group.status = status;
    if (budget !== undefined) {
      group.members.forEach((m) => {
        m.budget = budget;
      });
    }

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

    await group.save();

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

    // Find the member
    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );

    // Owner can also approve (they're not in members array)
    const isOwner = String(group.owner) === String(userId);

    if (!member && !isOwner) {
      return res.status(403).json({ ok: false, error: "Not a group member" });
    }

    if (member) {
      member.approved = true;
      member.approvedAt = new Date();
    }

    // Check if everyone approved
    const allApproved = group.members.every(
      (m) => m.approved || m.status === "declined"
    );

    if (allApproved) {
      group.status = "confirmed";
    }

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({
      ok: true,
      group: populated,
      allApproved,
    });
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

    // Reset the requester's approval
    const member = group.members.find(
      (m) => m.user && String(m.user) === String(userId)
    );
    if (member) {
      member.approved = false;
      member.approvedAt = null;
    }

    // Move back to reviewing if was confirmed
    if (group.status === "confirmed") {
      group.status = "reviewing";
    }

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
    // Resolve all change requests
    group.changeRequests.forEach((cr) => {
      if (cr.status === "open") cr.status = "resolved";
    });

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

    group.members.splice(memberIndex, 1);
    await group.save();

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

    // Check for duplicates
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

    await group.save();

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

export default router;
