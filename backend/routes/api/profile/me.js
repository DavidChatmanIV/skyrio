import { Router } from "express";
import jwt from "jsonwebtoken";
import Profile from "../../models/profile.js";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

/**
 * Tries to extract userId from Bearer token.
 * Returns userId string or null — never throws / rejects.
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

// ─── GET /api/profile/me ─────────────────────────────────────
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

// ─── GET /api/profile/public/:username ───────────────────────
// No auth required — anyone can view a public passport.
// If a valid token is present, returns `isFollowing` status.
router.get("/public/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Case-insensitive username lookup
    const targetUser = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    })
      .select(
        "_id username name avatar bio city xp currentBadge followersCount followingCount"
      )
      .lean();

    if (!targetUser) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // Optional: check if the caller follows this user
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

    return res.json({
      ok: true,
      user: targetUser,
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
