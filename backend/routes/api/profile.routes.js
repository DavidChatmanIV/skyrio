import { Router } from "express";
import Profile from "../../models/profile.js";
import User from "../../models/user.js";
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    return res.json({
      ok: true,
      user: {
        ...user.toSafeJSON(),
        bio: profile?.bio || "",
        city: profile?.city || user.toSafeJSON().city || "",
        homeBase: profile?.homeBase || "",
      },
      profile,
    });
  } catch (err) {
    console.error("Profile me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// PATCH /api/profile/settings
router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const { username, fullName, bio, city, country, homeAirport, vibe } =
      req.body;

    const profileUpdates = {};
    const userUpdates = {};

    if (username) {
      const normalized = String(username).trim().toLowerCase();
      if (!/^[a-zA-Z0-9_.]{3,30}$/.test(normalized)) {
        return res.status(400).json({
          ok: false,
          message: "Username must be 3–30 chars, letters/numbers/_ only",
        });
      }
      const existing = await User.findOne({
        username: normalized,
        _id: { $ne: req.user._id },
      }).lean();
      if (existing) {
        return res
          .status(409)
          .json({ ok: false, message: "Username already taken" });
      }
      userUpdates.username = normalized;
      profileUpdates.username = normalized;
    }

    const allowedProfileFields = [
      "fullName",
      "bio",
      "city",
      "country",
      "homeAirport",
      "vibe",
    ];
    for (const key of allowedProfileFields) {
      if (key in req.body) profileUpdates[key] = req.body[key];
    }

    const [profile] = await Promise.all([
      Profile.findOneAndUpdate(
        { user: req.user._id },
        { $set: profileUpdates },
        { new: true, upsert: true }
      ),
      Object.keys(userUpdates).length > 0
        ? User.findByIdAndUpdate(req.user._id, { $set: userUpdates })
        : Promise.resolve(),
    ]);

    return res.json({ ok: true, message: "Settings updated", profile });
  } catch (err) {
    console.error("Profile settings error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update settings" });
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
      if (key in req.body) updates[key] = req.body[key];
    }

    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, message: "Profile updated", profile });
  } catch (err) {
    console.error("Profile update error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update profile" });
  }
});

// GET /api/profile/:username
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

export default router;
