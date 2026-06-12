import { Router } from "express";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const XP_REFERRER = 50; // XP granted to the person who shared
const XP_NEW_USER = 25; // Bonus XP granted to the new signup

/* ============================================================
   POST /api/referral/complete
   Called from auth.routes.js register handler after a user
   successfully creates an account with a referredBy username.

   Body: { newUserId, referredBy }  (both required)
============================================================ */
router.post("/complete", async (req, res) => {
  try {
    const { newUserId, referredBy } = req.body || {};
    if (!newUserId || !referredBy)
      return res
        .status(400)
        .json({ ok: false, message: "newUserId and referredBy required." });

    // Grant bonus XP to the new user
    await User.findByIdAndUpdate(newUserId, {
      $inc: { xp: XP_NEW_USER },
      $set: { referredBy },
    });

    // Grant XP + increment referral count to the sharer
    const referrer = await User.findOneAndUpdate(
      { username: referredBy.toLowerCase() },
      { $inc: { xp: XP_REFERRER, referralsCount: 1 } },
      { new: true }
    );

    if (!referrer) {
      // Referrer username not found — still ok, new user keeps their bonus
      return res.json({ ok: true, referrerFound: false });
    }

    console.log(
      `[referral] ${referredBy} referred ${newUserId} — +${XP_REFERRER} XP`
    );
    res.json({ ok: true, referrerFound: true, xpGranted: XP_REFERRER });
  } catch (err) {
    console.error("[referral] complete error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* ============================================================
   GET /api/referral/stats
   Returns the logged-in user's referral count and XP earned
   from referrals. Used to show the stat on the passport.
============================================================ */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("referralsCount")
      .lean();

    res.json({
      ok: true,
      referralsCount: user?.referralsCount || 0,
      xpEarned: (user?.referralsCount || 0) * 50,
    });
  } catch (err) {
    console.error("[referral] stats error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
