import { Router } from "express";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const XP_REFERRER = 50;
const XP_NEW_USER = 25;
const XP_SHARE_DAY = 10;

// POST /api/referral/complete
router.post("/complete", async (req, res) => {
  try {
    const { newUserId, referredBy } = req.body || {};
    if (!newUserId || !referredBy)
      return res
        .status(400)
        .json({ ok: false, message: "newUserId and referredBy required." });

    await User.findByIdAndUpdate(newUserId, {
      $inc: { xp: XP_NEW_USER },
      $set: { referredBy },
    });

    const referrer = await User.findOneAndUpdate(
      { username: referredBy.toLowerCase() },
      { $inc: { xp: XP_REFERRER, referralsCount: 1 } },
      { new: true }
    );

    if (!referrer) return res.json({ ok: true, referrerFound: false });

    console.log(
      `[referral] ${referredBy} referred ${newUserId} — +${XP_REFERRER} XP`
    );
    res.json({ ok: true, referrerFound: true, xpGranted: XP_REFERRER });
  } catch (err) {
    console.error("[referral] complete error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/referral/share-xp
router.post("/share-xp", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const user = await User.findById(req.user._id)
      .select("xp lastShareXpDate")
      .lean();

    if (!user)
      return res.status(404).json({ ok: false, message: "User not found." });

    if (user.lastShareXpDate === today)
      return res.json({
        ok: true,
        awarded: false,
        reason: "already_awarded_today",
      });

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { xp: XP_SHARE_DAY },
      $set: { lastShareXpDate: today },
    });

    console.log(`[referral] share-xp +${XP_SHARE_DAY} XP → ${req.user._id}`);
    res.json({ ok: true, awarded: true, xp: XP_SHARE_DAY });
  } catch (err) {
    console.error("[referral] share-xp error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/referral/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("referralsCount")
      .lean();
    res.json({
      ok: true,
      referralsCount: user?.referralsCount || 0,
      xpEarned: (user?.referralsCount || 0) * XP_REFERRER,
    });
  } catch (err) {
    console.error("[referral] stats error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
