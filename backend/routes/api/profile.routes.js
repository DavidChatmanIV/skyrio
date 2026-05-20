import { Router } from "express";
import jwt from "jsonwebtoken";
import Profile from "../../models/profile.js";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "changeme";

/**
 * Tries to extract userId from Bearer token — never throws.
 */
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

// Helper: merge User + Profile data so avatar/name are always present
async function getFullProfile(userId) {
  let profile = await Profile.findOne({ user: userId });
  if (!profile) {
    const user = await User.findById(userId).select("username").lean();
    profile = await Profile.create({
      user: userId,
      username: user?.username || "",
    });
  }

  // Get User model data for avatar, name, xp, etc.
  const user = await User.findById(userId)
    .select(
      "username name avatar bio city xp currentBadge followersCount followingCount followers following"
    )
    .lean();

  const profileObj = profile.toObject ? profile.toObject() : profile;

  // Merge: prefer non-empty values from either model
  return {
    ...profileObj,
    username: profileObj.username || user?.username || "",
    name: user?.name || profileObj.fullName || "",
    avatar:
      user?.avatar && user.avatar !== "/default-avatar.png"
        ? user.avatar
        : profileObj.avatar && profileObj.avatar !== ""
        ? profileObj.avatar
        : user?.avatar || "/default-avatar.png",
    bio: user?.bio || profileObj.bio || "",
    city: user?.city || profileObj.city || "",
    xp: user?.xp || 0,
    currentBadge: user?.currentBadge || "Explorer",
    followersCount: user?.followers?.length ?? user?.followersCount ?? 0,
    followingCount: user?.following?.length ?? user?.followingCount ?? 0,
  };
}

// GET /api/profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const profile = await getFullProfile(req.user._id);
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("Profile me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// GET /api/profile/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await getFullProfile(req.user._id);
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("Profile me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

// GET /api/profile/public/:username — no auth required
router.get("/public/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username (case-insensitive)
    const targetUser = await User.findOne({
      username: {
        $regex: new RegExp(
          `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    })
      .select(
        "_id username name avatar bio city xp currentBadge followers following followersCount followingCount isOfficial createdAt"
      )
      .lean();

    if (!targetUser) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // Use array length as source of truth for counts
    const followersCount =
      targetUser.followers?.length ?? targetUser.followersCount ?? 0;
    const followingCount =
      targetUser.following?.length ?? targetUser.followingCount ?? 0;

    // Check if the viewer follows this user
    let isFollowing = false;
    const callerId = getOptionalUserId(req);
    if (callerId && String(callerId) !== String(targetUser._id)) {
      const caller = await User.findById(callerId).select("following").lean();
      if (caller?.following?.length) {
        isFollowing = caller.following.some(
          (id) => String(id) === String(targetUser._id)
        );
      }
    }

    // Get extra data from Profile model (avatar override, music, etc.)
    let profileMusic = null;
    let profileAvatar = null;
    let profileBio = null;
    let profileCity = null;
    let travelVibes = [];
    try {
      const profile = await Profile.findOne({ user: targetUser._id }).lean();
      if (profile) {
        if (profile.profileMusic?.url) profileMusic = profile.profileMusic;
        if (
          profile.avatar &&
          profile.avatar !== "/default-avatar.png" &&
          profile.avatar !== ""
        )
          profileAvatar = profile.avatar;
        if (profile.bio) profileBio = profile.bio;
        if (profile.city) profileCity = profile.city;
        if (profile.travelVibes?.length) travelVibes = profile.travelVibes;
      }
    } catch {
      /* no profile data */
    }

    // Use Profile avatar if User avatar is default, or vice versa
    const avatar =
      targetUser.avatar && targetUser.avatar !== "/default-avatar.png"
        ? targetUser.avatar
        : profileAvatar || targetUser.avatar;

    const bio = targetUser.bio || profileBio;
    const city = targetUser.city || profileCity;

    const publicData = {
      _id: targetUser._id,
      id: String(targetUser._id),
      username: targetUser.username,
      name: targetUser.name,
      avatar,
      bio,
      city,
      xp: targetUser.xp || 0,
      badge: targetUser.currentBadge || "Explorer",
      currentBadge: targetUser.currentBadge || "Explorer",
      isOfficial: targetUser.isOfficial || false,
      followersCount,
      followingCount,
      joinedAt: targetUser.createdAt,
      profileMusic,
      travelVibes,
    };

    return res.json({
      ok: true,
      user: publicData,
      profile: publicData,
      isFollowing,
    });
  } catch (err) {
    console.error("Public profile error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

export default router;
