import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const router = Router();

const COOKIE_NAME = "skyrio_admin";
const ORANGE_THRESHOLD = 1_000;
const BLUE_THRESHOLD = 5_000;

/* =====================================================
   Admin Auth — mirrors admin.routes.js pattern exactly
===================================================== */
function readAdminFromCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.isAdmin) return null;
    return decoded;
  } catch {
    return null;
  }
}

function readAdminFromHeader(req) {
  const email = req.headers?.["x-admin-email"];
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!email || !ADMIN_EMAIL) return null;
  if (String(email).toLowerCase() !== String(ADMIN_EMAIL).toLowerCase())
    return null;
  return { isAdmin: true, email };
}

function verifyAdmin(req, res, next) {
  if (!process.env.JWT_SECRET)
    return res
      .status(500)
      .json({ ok: false, error: "Server misconfigured: JWT_SECRET missing" });

  const admin = readAdminFromCookie(req) || readAdminFromHeader(req);
  if (!admin)
    return res.status(401).json({ ok: false, error: "Admin unauthorized" });

  req.admin = admin;
  next();
}

/* =====================================================
   GET /api/verification/pending
   Lists all users flagged for review, sorted by
   follower count descending so biggest accounts
   are at the top of the queue.
===================================================== */
router.get("/pending", verifyAdmin, async (_req, res) => {
  try {
    const users = await User.find({
      verificationPending: true,
      verifiedTier: null,
    })
      .select("_id username name avatar followersCount createdAt")
      .sort({ followersCount: -1 })
      .lean();

    res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error("[verification] pending error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* =====================================================
   POST /api/verification/approve/:userId
   Assigns orange or blue tier based on current
   follower count. Re-reads the count fresh from DB
   so it can't be gamed by the time you approve.
===================================================== */
router.post("/approve/:userId", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user)
      return res.status(404).json({ ok: false, message: "User not found." });

    const followers = user.followersCount || 0;

    const tier =
      followers >= BLUE_THRESHOLD
        ? "blue"
        : followers >= ORANGE_THRESHOLD
        ? "orange"
        : null;

    if (!tier) {
      return res.status(400).json({
        ok: false,
        message: `${user.username} only has ${followers} followers — threshold not met.`,
      });
    }

    user.verifiedTier = tier;
    user.verificationPending = false;
    await user.save();

    console.log(`[verification] Approved ${user.username} → ${tier} tier`);
    res.json({ ok: true, message: `Approved — ${tier} tier assigned.`, tier });
  } catch (err) {
    console.error("[verification] approve error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* =====================================================
   POST /api/verification/deny/:userId
   Clears the pending flag with no tier granted.
   User can be re-flagged naturally if they keep
   growing followers.
===================================================== */
router.post("/deny/:userId", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user)
      return res.status(404).json({ ok: false, message: "User not found." });

    user.verificationPending = false;
    await user.save();

    console.log(`[verification] Denied ${user.username}`);
    res.json({ ok: true, message: "Request denied and cleared." });
  } catch (err) {
    console.error("[verification] deny error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* =====================================================
   POST /api/verification/revoke/:userId
   Strips a badge from any user — for fake follower
   abuse or any other reason.
===================================================== */
router.post("/revoke/:userId", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user)
      return res.status(404).json({ ok: false, message: "User not found." });

    user.verifiedTier = null;
    user.verificationPending = false;
    await user.save();

    console.log(`[verification] Revoked badge from ${user.username}`);
    res.json({ ok: true, message: "Verification revoked." });
  } catch (err) {
    console.error("[verification] revoke error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;

/* =====================================================
   autoFlagForVerification(targetUserId)

   Call this in follow.routes.js after a successful
   follow increment. Accepts the target user's ID
   (string or ObjectId) — does its own lean fetch so
   it works with your updateOne/$inc pattern without
   needing a full document.

   Usage in follow.routes.js POST handler:

     import { autoFlagForVerification } from "../verificationRoutes.js";

     // ...after the target updateOne:
     if (changed) {
       await User.updateOne(
         { _id: target, followers: { $ne: me } },
         { $addToSet: { followers: me }, $inc: { followersCount: 1 } }
       );
       await autoFlagForVerification(target); // ← add this line
     }
===================================================== */
export async function autoFlagForVerification(targetUserId) {
  try {
    // Lean fetch — we only need the fields we check
    const user = await User.findById(targetUserId)
      .select("_id username followersCount verifiedTier verificationPending")
      .lean();

    if (!user) return; // user deleted mid-request
    if (user.verifiedTier) return; // already verified
    if (user.verificationPending) return; // already in the queue

    // Founder gets purple through assignFounderBadge(), not this flow
    const founderId = process.env.FOUNDER_USER_ID;
    if (founderId && String(user._id) === String(founderId)) return;

    const f = user.followersCount || 0;
    const crossedThreshold = f === ORANGE_THRESHOLD || f === BLUE_THRESHOLD;

    if (crossedThreshold) {
      await User.updateOne(
        { _id: user._id },
        { $set: { verificationPending: true } }
      );
      console.log(
        `[verification] ${user.username} hit ${f} followers — flagged for review.`
      );
    }
  } catch (err) {
    // Non-fatal — never let this break the follow request
    console.error("[verification] autoFlag error:", err);
  }
}

/* =====================================================
   assignFounderBadge()

   Run once on server startup to ensure your account
   always has the purple tier. Safe to run every boot
   — it's an idempotent upsert.

   Usage in server.js / app.js:

     import { assignFounderBadge } from "./routes/verificationRoutes.js";
     await assignFounderBadge();

   Requires FOUNDER_USER_ID in your .env on Render.
   Get your ID from MongoDB Atlas → users collection
   or from GET /api/profile/me → _id field.
===================================================== */
export async function assignFounderBadge() {
  const founderId = process.env.FOUNDER_USER_ID;
  if (!founderId) {
    console.warn(
      "[verification] FOUNDER_USER_ID not set — skipping founder badge."
    );
    return;
  }
  await User.findByIdAndUpdate(founderId, {
    $set: { verifiedTier: "purple", verificationPending: false },
  });
  console.log("[verification] ✦ Purple founder badge assigned.");
}
