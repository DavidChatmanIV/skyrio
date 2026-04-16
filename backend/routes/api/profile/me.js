import { Router } from "express";
import Profile from "../../models/profile.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /api/profile/me
router.get("/", requireAuth, async (req, res) => {
  try {
    let profile = await Profile.findOne({ user: req.user._id });

    if (!profile) {
      profile = await Profile.create({
        user: req.user._id,
        username: req.user.username,
      });
    }

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("Profile me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

export default router;