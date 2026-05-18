import { Router } from "express";
import Profile from "../../models/profile.js";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getLevel } from "../../lib/xpLevels.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/profile/me
// ─────────────────────────────────────────────────────────────
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

    const levelData = getLevel(user.xp || 0);

    return res.json({
      ok: true,
      user: {
        ...user.toSafeJSON(),
        bio: profile?.bio || "",
        city: profile?.city || user.toSafeJSON().city || "",
        homeBase: profile?.homeBase || "",
        avatar: profile?.avatar || user.toSafeJSON().avatar || "",
      },
      profile,
      xp: user.xp || 0,
      currentBadge: levelData.current,
      nextBadge: levelData.next,
      xpToNextBadge: levelData.xpToNext,
      xpIntoLevel: levelData.xpIntoLevel,
      xpNeeded: levelData.xpNeeded,
      badgePercent: levelData.percent,
    });
  } catch (err) {
    console.error("Profile me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// ─────────────────────────────────────────────────────────────
// ✅ GET /api/profile/music
// Returns the user's saved profile music.
// Frontend: DigitalPassportPage + ProfileMusicModal
// ─────────────────────────────────────────────────────────────
router.get("/music", requireAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id }).select(
      "profileMusic"
    );
    const music = profile?.profileMusic?.url ? profile.profileMusic : null;
    return res.json({ ok: true, music });
  } catch (err) {
    console.error("Get music error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch music" });
  }
});

// ─────────────────────────────────────────────────────────────
// ✅ POST /api/profile/music
// Saves profile music — syncs across all devices.
// Body: { music: { url, name, provider, updatedAt } }
// ─────────────────────────────────────────────────────────────
router.post("/music", requireAuth, async (req, res) => {
  try {
    const { music } = req.body;
    if (!music?.url) {
      return res
        .status(400)
        .json({ ok: false, message: "music.url is required" });
    }

    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          profileMusic: {
            url: String(music.url).trim(),
            name: String(music.name || "My Travel Soundtrack").trim(),
            provider: String(music.provider || "youtube").trim(),
            updatedAt: new Date(),
          },
        },
      },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, music: profile.profileMusic });
  } catch (err) {
    console.error("Save music error:", err);
    return res.status(500).json({ ok: false, message: "Failed to save music" });
  }
});

// ─────────────────────────────────────────────────────────────
// ✅ DELETE /api/profile/music
// Clears profile music.
// ─────────────────────────────────────────────────────────────
router.delete("/music", requireAuth, async (req, res) => {
  try {
    await Profile.findOneAndUpdate(
      { user: req.user._id },
      { $unset: { profileMusic: "" } },
      { upsert: false }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete music error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete music" });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/profile/settings
// ─────────────────────────────────────────────────────────────
router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const {
      username,
      fullName,
      bio,
      city,
      country,
      homeAirport,
      homeAirportData,
      vibe,
      travelVibes,
    } = req.body;

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

    // Standard profile fields
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

    // ✅ n7: Travel vibes from onboarding
    if (Array.isArray(travelVibes)) {
      profileUpdates.travelVibes = travelVibes.slice(0, 3);
    }

    // ✅ s2: Home airport object from onboarding
    if (homeAirportData && homeAirportData.code) {
      profileUpdates.homeAirportData = {
        code: homeAirportData.code,
        city: homeAirportData.city || "",
        name: homeAirportData.name || "",
      };
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

// ─────────────────────────────────────────────────────────────
// PATCH /api/profile/update
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// ✅ s2: GET /api/profile/public/:username
// Public passport page — no auth required.
// Only exposes safe fields — never email, phone, bookings.
// ─────────────────────────────────────────────────────────────
router.get("/public/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const profile = await Profile.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    }).lean();

    if (!profile) {
      return res.status(404).json({ ok: false, message: "Profile not found" });
    }

    // Get XP + badge from user
    const user = await User.findById(profile.user)
      .select("xp username name")
      .lean();
    const levelData = user
      ? getLevel(user.xp || 0)
      : { current: "Explorer", next: "Adventurer", percent: 0 };

    // Safe public subset — never expose email, token, private fields
    const publicProfile = {
      name: user?.name || profile.fullName || profile.username || null,
      username: profile.username || null,
      avatar: profile.avatar || null,
      bio: profile.bio || null,
      city: profile.city || null,
      badge: levelData.current,
      xp: user?.xp || 0,
      xpPercent: levelData.percent || 0,
      nextBadge: levelData.next || null,
      travelVibes: profile.travelVibes || [],
      profileMusic: profile.profileMusic?.url
        ? {
            url: profile.profileMusic.url,
            name: profile.profileMusic.name,
            provider: profile.profileMusic.provider,
          }
        : null,
      joinedAt: profile.createdAt || null,
    };

    return res.json({ ok: true, profile: publicProfile });
  } catch (err) {
    console.error("Public profile error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/profile/:username (existing — keep last, catch-all)
// ─────────────────────────────────────────────────────────────
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
