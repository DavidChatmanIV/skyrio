import { Router } from "express";
import User from "../../models/user.js";
import RewardItem from "../../models/rewardItem.js";
import { requireAuth } from "../../middleware/requireAuth.js";
// ✅ The real verifyAdmin — same one that gates /api/admin/dashboard,
// confirmed against the actual admin.routes.js source (not a same-named
// lookalike from middleware/auth.js or middleware/verifyAdminToken.js,
// both of which exist in this codebase but are NOT what AdminDashboard.jsx
// actually authenticates against).
import { verifyAdmin } from "../admin.routes.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────
// ✅ REMOVED: the old hardcoded REWARDS_CATALOG object. Every item it had
// (weekend_xp, review_streak, globetrotter, priority_support, wc_jacket)
// has been carried forward into the RewardItem collection via the one-time
// seed script — see scripts/seedRewards.js. Nothing about what users see
// should change the moment this deploys; the data just now lives in Mongo
// instead of being duplicated across two hardcoded JS files.
//
// ⚠️ Still true and still unresolved: "globetrotter" here is a purchasable
// badge item, but the XP tier ladder also has a tier literally called
// "Globetrotter" (reached automatically at 1000 XP). Worth renaming one of
// these — that's a product/copy decision, not something I'm changing here.
// ─────────────────────────────────────────────────────────────────────────

// GET /api/rewards/items
// Public catalog listing — no per-user data here on purpose. The frontend
// already fetches personalized redeemed-state separately via GET
// /redeemed below and combines the two client-side; this keeps that
// existing, already-correct split instead of merging concerns that don't
// need to be merged.
router.get("/items", async (req, res) => {
  try {
    const items = await RewardItem.find({ active: true })
      .sort({ type: 1, cost: 1 })
      .lean();
    return res.json({
      ok: true,
      items: items.map((i) => ({
        id: i.itemId,
        type: i.type,
        title: i.title,
        desc: i.desc,
        cost: i.cost,
        level: i.level,
        featured: i.featured,
        repeatable: i.repeatable,
        isNew: i.isNewItem,
      })),
    });
  } catch (err) {
    console.error("[rewards] items list error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load rewards." });
  }
});

// GET /api/rewards/redeemed
// Unchanged — still reads req.user.redeemedRewards directly off the
// already-loaded full Mongoose doc that requireAuth provides.
router.get("/redeemed", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    redeemedRewards: req.user.redeemedRewards || [],
  });
});

// POST /api/rewards/redeem
// Body: { itemId: string }
// ✅ UNCHANGED logic: the atomic findOneAndUpdate with xp: { $gte: cost }
// is the actual security-critical piece here — it's what stops two open
// tabs from double-spending the same XP, since only the first request to
// reach Mongo can match the filter. The only thing that changed is WHERE
// the reward's cost/repeatable/title come from (the database now, not an
// in-memory object) — the redeem logic itself is byte-identical to before.
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ ok: false, message: "Missing itemId." });
    }

    const reward = await RewardItem.findOne({ itemId, active: true }).lean();
    if (!reward) {
      return res
        .status(400)
        .json({ ok: false, message: "Unknown reward item." });
    }

    const userId = req.user._id;

    const filter = {
      _id: userId,
      xp: { $gte: reward.cost },
    };
    const update = {
      $inc: { xp: -reward.cost },
    };

    if (!reward.repeatable) {
      filter.redeemedRewards = { $ne: itemId };
      update.$push = { redeemedRewards: itemId };
    }

    const updatedUser = await User.findOneAndUpdate(filter, update, {
      new: true,
    }).select("xp redeemedRewards");

    if (!updatedUser) {
      if (!reward.repeatable && req.user.redeemedRewards?.includes(itemId)) {
        return res
          .status(409)
          .json({ ok: false, message: "You've already redeemed this." });
      }
      return res.status(400).json({ ok: false, message: "Not enough XP." });
    }

    return res.json({
      ok: true,
      item: { id: itemId, title: reward.title, cost: reward.cost },
      newBalance: updatedUser.xp,
    });
  } catch (err) {
    console.error("Reward redeem error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Something went wrong. Please try again." });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN CONTROL — create / edit / remove catalog items.
   Same verifyAdmin as Challenges, same soft-remove-not-hard-delete
   pattern, for the same reason: a hard delete would orphan anyone's
   existing redeemedRewards entry for that item.
───────────────────────────────────────────────────────────── */

// GET /api/rewards/items/admin — every item regardless of active flag,
// so the admin screen can see (and potentially restore) removed items too.
router.get("/items/admin", verifyAdmin, async (req, res) => {
  try {
    const items = await RewardItem.find({}).sort({ createdAt: -1 }).lean();
    return res.json({
      ok: true,
      items: items.map((i) => ({ ...i, id: i._id, isNew: i.isNewItem })),
    });
  } catch (err) {
    console.error("[rewards] admin list error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load rewards." });
  }
});

// POST /api/rewards/items — create a new catalog item
router.post("/items", verifyAdmin, async (req, res) => {
  try {
    const {
      itemId,
      title,
      desc,
      type,
      cost,
      level,
      featured,
      repeatable,
      isNew,
    } = req.body;

    if (!itemId || !title || !desc || !type || cost == null) {
      return res.status(400).json({
        ok: false,
        message: "itemId, title, desc, type, and cost are required.",
      });
    }

    const existing = await RewardItem.findOne({ itemId });
    if (existing) {
      return res.status(409).json({
        ok: false,
        message: `An item with itemId "${itemId}" already exists.`,
      });
    }

    const item = await RewardItem.create({
      itemId,
      title,
      desc,
      type,
      cost,
      level: level ?? 1,
      featured: !!featured,
      repeatable: !!repeatable,
      isNewItem: !!isNew,
    });

    return res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error("[rewards] create item error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create reward item." });
  }
});

// PATCH /api/rewards/items/:itemId — edit an existing item. itemId itself
// is deliberately NOT in the allowed list — changing it would orphan it
// from anyone's existing User.redeemedRewards entries.
router.patch("/items/:itemId", verifyAdmin, async (req, res) => {
  try {
    const allowed = [
      "title",
      "desc",
      "type",
      "cost",
      "level",
      "featured",
      "repeatable",
      "active",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    // ✅ Handled separately, not in the generic passthrough loop above —
    // the request body uses "isNew" (matching what both frontend files
    // already send), but the schema field is "isNewItem". Passing
    // "isNew" straight through to $set would write to the reserved
    // Mongoose pathname directly, the exact collision this rename exists
    // to avoid.
    if ("isNew" in req.body) {
      updates.isNewItem = !!req.body.isNew;
    }

    const item = await RewardItem.findOneAndUpdate(
      { itemId: req.params.itemId },
      { $set: updates },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ ok: false, message: "Item not found." });
    }
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[rewards] update item error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update reward item." });
  }
});

// DELETE /api/rewards/items/:itemId — soft-remove (active: false), not a
// hard delete. Preserves redemption history for anyone who already
// redeemed this item; it just stops showing up in the live catalog.
router.delete("/items/:itemId", verifyAdmin, async (req, res) => {
  try {
    const item = await RewardItem.findOneAndUpdate(
      { itemId: req.params.itemId },
      { $set: { active: false } },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ ok: false, message: "Item not found." });
    }
    return res.json({ ok: true, message: "Item removed.", item });
  } catch (err) {
    console.error("[rewards] remove item error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to remove reward item." });
  }
});

export default router;
