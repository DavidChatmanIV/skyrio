import { Router } from "express";
import User from "../../models/user.js";

const router = Router();

const XP_REFERRER = 50;
const XP_NEW_USER = 25;

// ── POST /api/referral/complete ───────────────────────────────
// Called from auth register after a new user signs up via ?ref=
// No auth needed — fired automatically after successful signup.
// Body: { newUserId, referredBy }
router.post("/complete", async (req, res) => {
  try {
    const { newUserId, referredBy } = req.body || {};
    if (!newUserId || !referredBy)
      return res
        .status(400)
        .json({ ok: false, message: "newUserId and referredBy required." });

    // Grant bonus XP to the new signup
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

export default router;
