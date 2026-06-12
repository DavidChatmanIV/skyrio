/**
 * routes/admin.js
 * Admin-only actions — requires role === 'admin'
 */
import { Router } from "express";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// Middleware: admin only
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ ok: false, message: "Admin access required" });
  }
  next();
}

// GET /api/admin/me — confirm admin status + current plan
router.get("/me", requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, role: req.user.role, plan: req.user.plan });
});

// PATCH /api/admin/set-plan — set your own plan to any tier
router.patch("/set-plan", requireAuth, requireAdmin, async (req, res) => {
  const { plan } = req.body;
  if (!["free", "explorer", "legend"].includes(plan)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid plan. Use free, explorer, or legend.",
    });
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { plan },
    { new: true }
  );
  return res.json({
    ok: true,
    message: `Plan updated to ${plan}`,
    plan: user.plan,
  });
});

// PATCH /api/admin/set-user-plan — set any user's plan (for testing)
router.patch("/set-user-plan", requireAuth, requireAdmin, async (req, res) => {
  const { userId, plan } = req.body;
  if (!userId || !["free", "explorer", "legend"].includes(plan)) {
    return res
      .status(400)
      .json({ ok: false, message: "userId and valid plan required" });
  }
  const user = await User.findByIdAndUpdate(userId, { plan }, { new: true });
  if (!user)
    return res.status(404).json({ ok: false, message: "User not found" });
  return res.json({
    ok: true,
    message: `${user.username} updated to ${plan}`,
    plan: user.plan,
  });
});

export default router;
