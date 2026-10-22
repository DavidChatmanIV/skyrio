import { Router } from "express";
import jwt from "jsonwebtoken";
import Profile from "../../models/profile.js";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
// ✅ Was importing from "../../lib/xpLevels.js" — a file with an unverified,
// differently-shaped getLevel() (current/next as plain strings, vs the real
// xpRules.js which returns objects with .name/.minXp/etc). Switched to the
// one ladder we've actually validated against live data (70 XP → Explorer,
// 70/100 — matched the real Passport page exactly). lib/xpLevels.js itself
// is left untouched in case anything else still imports it; only this
// file's import changed.
import { getLevel } from "../../config/xpRules.js";
import { applyBalance } from "../../services/xpService.js";

// Rank comes from LIFETIME earned XP, never the spendable balance —
// redeeming rewards must never lower someone's rank.
// Lifetime can never be lower than the current balance (guards old accounts
// whose xpTotalEarned was never kept in sync).
const lifetimeXp = (u) =>
  Math.max(Number(u?.xpTotalEarned ?? 0), Number(u?.xp ?? 0));

const router = Router();

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "changeme";

function getOptionalUserId(req) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || decoded?._id || decoded?.userId || null;
  } catch {
    return null;
  }
}

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

    const levelData = getLevel(lifetimeXp(user));
    const safe = user.toSafeJSON();

    return res.json({
      ok: true,
      user: {
        ...safe,
        bio: profile?.bio || safe.bio || "",
        city: profile?.city || safe.city || "",
        homeBase: profile?.homeBase || safe.city || "",
        avatar: profile?.avatar || safe.avatar || "",
        travelVibes: profile?.travelVibes?.length
          ? profile.travelVibes
          : safe.travelVibes || [],
        // Home airport: the account's, else one saved on the older Profile.
        homeAirport: safe.homeAirport?.code
          ? safe.homeAirport
          : profile?.homeAirportData?.code
          ? {
              code: profile.homeAirportData.code,
              city:
                profile.homeAirportData.city || profile.homeAirportData.code,
              name:
                profile.homeAirportData.name ||
                profile.homeAirportData.city ||
                "",
            }
          : null,
        // Verification — explicit so frontend always gets these
        verifiedTier: safe.verifiedTier ?? null,
        verificationPending: safe.verificationPending ?? false,
        // Referrals — read here so no separate /referral/stats call needed
        referralsCount: safe.referralsCount ?? 0,
        referredBy: safe.referredBy ?? null,
      },
      profile,
      xp: user.xp || 0, // spendable balance
      xpTotalEarned: lifetimeXp(user), // lifetime — drives rank
      // ✅ levelData.current/.next are now objects ({ name, minXp, ... })
      // from the real xpRules.js getLevel() — extract .name so the JSON
      // shape sent to the frontend is unchanged (still plain strings, since
      // DigitalPassportPage.jsx does String(data?.currentBadge ?? ...)).
      currentBadge: levelData.current.name,
      nextBadge: levelData.next?.name || null,
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
// GET /api/profile/music
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
// POST /api/profile/music
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
// DELETE /api/profile/music
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

    // Sync city to User model so homeBaseLabel on passport reads correctly
    // from both Profile and User without a second query
    if (city !== undefined) {
      userUpdates.city = String(city).trim();
    }

    if (Array.isArray(travelVibes)) {
      profileUpdates.travelVibes = travelVibes.slice(0, 5);
      // Keep User.travelVibes in sync for search/badge queries
      userUpdates.travelVibes = travelVibes.slice(0, 5);
    }

    // Home airport (Digital Passport). Saved on BOTH Profile and User:
    // User.homeAirport is what the booking page reads on any device.
    // Sending homeAirportData: null clears it.
    if (homeAirportData === null) {
      profileUpdates.homeAirportData = null;
      userUpdates.homeAirport = { code: null, city: null, name: null };
    } else if (homeAirportData?.code) {
      const code = String(homeAirportData.code).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        return res.status(400).json({
          ok: false,
          message: "Pick your home airport from the list.",
        });
      }
      const clip = (v) =>
        String(v || "")
          .replace(/[<>]/g, "")
          .trim()
          .slice(0, 120);
      const ap = {
        code,
        city: clip(homeAirportData.city) || code,
        name: clip(homeAirportData.name) || clip(homeAirportData.city) || code,
      };
      profileUpdates.homeAirportData = ap;
      userUpdates.homeAirport = ap;
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

    // Keep User.avatar in sync when avatar is updated (e.g. from avatar upload)
    if (req.body.avatar) {
      await User.findByIdAndUpdate(req.user._id, {
        $set: { avatar: req.body.avatar },
      });
    }

    return res.json({ ok: true, message: "Profile updated", profile });
  } catch (err) {
    console.error("Profile update error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update profile" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/profile/public/:username
// ─────────────────────────────────────────────────────────────
router.get("/public/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const profile = await Profile.findOne({
      username: {
        $regex: new RegExp(
          `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    }).lean();

    if (!profile) {
      return res.status(404).json({ ok: false, message: "Profile not found" });
    }

    const user = await User.findById(profile.user)
      .select(
        // Added verifiedTier so the public passport page can show the badge
        "xp xpTotalEarned username name avatar followers following followersCount followingCount isOfficial verifiedTier createdAt"
      )
      .lean();

    // ✅ levelData.current/.next are objects from the real getLevel() now,
    // not plain strings — extract .name explicitly (with the same
    // "Explorer"/null fallback behavior as before) instead of relying on
    // the old fallback literal, which assumed current/next were strings.
    const levelData = user ? getLevel(lifetimeXp(user)) : null;
    const currentBadgeName = levelData?.current?.name || "Explorer";
    const nextBadgeName = levelData?.next?.name || null;
    const badgePercentValue = levelData?.percent || 0;

    const followersCount = user?.followers?.length ?? user?.followersCount ?? 0;
    const followingCount = user?.following?.length ?? user?.followingCount ?? 0;

    let isFollowing = false;
    const callerId = getOptionalUserId(req);
    if (callerId && user && String(callerId) !== String(user._id)) {
      const caller = await User.findById(callerId).select("following").lean();
      if (caller?.following?.length) {
        isFollowing = caller.following.some(
          (id) => String(id) === String(user._id)
        );
      }
    }

    const avatar =
      profile.avatar &&
      profile.avatar !== "/default-avatar.png" &&
      profile.avatar !== ""
        ? profile.avatar
        : user?.avatar && user.avatar !== "/default-avatar.png"
        ? user.avatar
        : profile.avatar || null;

    const publicProfile = {
      _id: user?._id || profile.user,
      id: String(user?._id || profile.user),
      name: user?.name || profile.fullName || profile.username || null,
      username: profile.username || user?.username || null,
      avatar,
      bio: profile.bio || null,
      city: profile.city || null,
      badge: currentBadgeName,
      currentBadge: currentBadgeName,
      // Public page shows lifetime XP (the rank number), not the private balance.
      xp: lifetimeXp(user),
      xpTotalEarned: lifetimeXp(user),
      xpPercent: badgePercentValue,
      nextBadge: nextBadgeName,
      isOfficial: user?.isOfficial || false,
      // Verification badge — shown on public passport page
      verifiedTier: user?.verifiedTier || null,
      followersCount,
      followingCount,
      travelVibes: profile.travelVibes || [],
      profileMusic: profile.profileMusic?.url
        ? {
            url: profile.profileMusic.url,
            name: profile.profileMusic.name,
            provider: profile.profileMusic.provider,
          }
        : null,
      joinedAt: profile.createdAt || user?.createdAt || null,
    };

    return res.json({
      ok: true,
      profile: publicProfile,
      user: publicProfile,
      isFollowing,
    });
  } catch (err) {
    console.error("Public profile error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/profile/share-xp
// Awards +10 XP for sharing passport link, once per day.
// Lives here (not in referral routes) because requireAuth
// is proven to work in this router.
// ─────────────────────────────────────────────────────────────
router.post("/share-xp", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Atomically claim today's share — double-clicks/parallel requests can't pay twice.
    const claimed = await User.findOneAndUpdate(
      { _id: req.user._id, lastShareXpDate: { $ne: today } },
      { $set: { lastShareXpDate: today } },
      { new: false, projection: { _id: 1 } }
    );
    if (!claimed) {
      const exists = await User.exists({ _id: req.user._id });
      if (!exists)
        return res.status(404).json({ ok: false, message: "User not found." });
      return res.json({
        ok: true,
        awarded: false,
        reason: "already_awarded_today",
      });
    }

    // Goes through applyBalance so it counts toward BOTH balance and lifetime rank,
    // and shows up in recent XP events.
    const balance = await applyBalance(
      req.user._id,
      { xp: 10 },
      {
        label: "Shared your passport",
        xp: 10,
        icon: "share",
        iconKey: "share",
        pending: false,
        time: Date.now(),
      }
    );

    console.log(`[profile] share-xp +10 XP → ${req.user._id}`);
    res.json({ ok: true, awarded: true, xp: 10, rankUp: balance.rankUp });
  } catch (err) {
    console.error("[profile] share-xp error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/profile/:username  (catch-all — keep last)
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
