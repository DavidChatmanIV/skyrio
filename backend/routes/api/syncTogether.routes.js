import { Router } from "express";
import User from "../../models/user.js";
import SyncGroup from "../../models/SyncGroup.js";
import { auth as authRequired } from "../../middleware/auth.js";

const router = Router();
router.use(authRequired);

/* ──────────────────────────────────────────────
   GET /api/sync-together/search?q=john
   ────────────────────────────────────────────── */
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ ok: true, users: [] });
    }

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
    if (!ownerId) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { members = [], title } = req.body;

    if (!members.length) {
      return res
        .status(400)
        .json({ ok: false, error: "Add at least one traveler" });
    }

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
   Fetch a single SyncGroup.
   ────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const group = await SyncGroup.findById(req.params.id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .lean();

    if (!group) {
      return res.status(404).json({ ok: false, error: "Group not found" });
    }

    return res.json({ ok: true, group });
  } catch (err) {
    console.error("[sync-together] fetch error:", err);
    return res.status(500).json({ ok: false, error: "Fetch failed" });
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/sync-together/:id
   Update group details (destination, dates, budget, title).
   ────────────────────────────────────────────── */
router.patch("/:id", async (req, res) => {
  try {
    const ownerId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ ok: false, error: "Group not found" });
    }

    if (String(group.owner) !== String(ownerId)) {
      // Check if user is a member of the group
      const isMember = group.members.some(
        (m) => m.user && String(m.user) === String(ownerId)
      );
      if (!isMember) {
        return res
          .status(403)
          .json({ ok: false, error: "Only group members can edit" });
      }
    }

    const { title, destination, dateRangeStart, dateRangeEnd, budget, status } =
      req.body;

    if (title !== undefined) group.title = title;
    if (destination !== undefined) group.destination = destination;
    if (dateRangeStart !== undefined) group.dateRangeStart = dateRangeStart;
    if (dateRangeEnd !== undefined) group.dateRangeEnd = dateRangeEnd;
    if (status !== undefined) group.status = status;

    // Update budget for all members if a group-wide budget is set
    if (budget !== undefined) {
      group.members.forEach((m) => {
        m.budget = budget;
      });
    }

    await group.save();

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] patch error:", err);
    return res.status(500).json({ ok: false, error: "Update failed" });
  }
});

export default router;
