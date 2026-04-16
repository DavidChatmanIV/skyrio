import { Router } from "express";
import Profile from "../../models/profile.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /api/profile/me
router.get("/me", requireAuth, async (req, res) => {
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

// GET /api/profile/:username  ← NEW — fetch any public profile by username
router.get("/:username", async (req, res) => {
  try {
    const profile = await Profile.findOne({ username: req.params.username });

    if (!profile) {
      return res.status(404).json({ ok: false, message: "Profile not found" });
    }

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// PATCH /api/profile/update
router.patch("/update", requireAuth, async (req, res) => {
  try {
    const allowedFields = [
      "fullName",
      "bio",
      "avatar",
      "city",
      "country",
      "homeAirport",
      "vibe",
      "badges",
      "username",
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (key in req.body) {
        updates[key] = req.body[key];
      }
    }

    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.json({
      ok: true,
      message: "Profile updated successfully",
      profile,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update profile" });
  }
});

export default router;