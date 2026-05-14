import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Booking from "../models/booking.js";
import Notification from "../models/notification.js";

const router = Router();
const COOKIE_NAME = "skyrio_admin";
const JWT_SECRET = process.env.JWT_SECRET;

/* =========================
   Admin Auth Helpers
========================= */
function signAdminToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function setAdminCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const secure =
    String(process.env.COOKIE_SECURE).toLowerCase() === "true" || isProd;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAdminCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  const secure =
    String(process.env.COOKIE_SECURE).toLowerCase() === "true" || isProd;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
}

function readAdminFromCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.isAdmin) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── Header-based fallback for localhost cross-port dev ──
function readAdminFromHeader(req) {
  const email = req.headers?.["x-admin-email"];
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!email || !ADMIN_EMAIL) return null;
  if (String(email).toLowerCase() !== String(ADMIN_EMAIL).toLowerCase())
    return null;
  return { isAdmin: true, email };
}

function verifyAdmin(req, res, next) {
  if (!JWT_SECRET) {
    return res
      .status(500)
      .json({ ok: false, error: "Server misconfigured: JWT_SECRET missing" });
  }

  // Try cookie first (production), then header fallback (local dev)
  const admin = readAdminFromCookie(req) || readAdminFromHeader(req);

  if (!admin) {
    return res.status(401).json({ ok: false, error: "Admin unauthorized" });
  }

  req.admin = admin;
  next();
}

/* =========================
   Auth Endpoints
========================= */
router.post("/login", async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res
        .status(500)
        .json({ ok: false, error: "Server misconfigured: JWT_SECRET missing" });
    }
    const { email, password } = req.body || {};
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const ok =
      email &&
      password &&
      ADMIN_EMAIL &&
      ADMIN_PASSWORD &&
      String(email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase() &&
      String(password) === String(ADMIN_PASSWORD);
    if (!ok)
      return res
        .status(401)
        .json({ ok: false, error: "Invalid admin credentials" });
    const token = signAdminToken({
      isAdmin: true,
      email: String(email).toLowerCase(),
    });
    setAdminCookie(res, token);
    return res.json({
      ok: true,
      admin: { email: String(email).toLowerCase() },
    });
  } catch (e) {
    console.error("[admin] Login failed:", e);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  clearAdminCookie(res);
  return res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const admin = readAdminFromCookie(req) || readAdminFromHeader(req);
  if (!admin) return res.status(401).json({ ok: false, isAdmin: false });
  return res.json({ ok: true, isAdmin: true, admin: { email: admin.email } });
});

/* =========================
   User Endpoints
========================= */
router.get("/users", verifyAdmin, async (_req, res) => {
  try {
    const users = await User.find({})
      .select("name username email role createdAt updatedAt isActive")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("[admin] Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users." });
  }
});

router.get("/staff", verifyAdmin, async (_req, res) => {
  try {
    const staff = await User.find({
      role: { $in: ["support", "manager", "admin"] },
    })
      .select("name username email role createdAt updatedAt isActive")
      .sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    console.error("[admin] Failed to load staff/admins:", err);
    res.status(500).json({ message: "Error loading staff/admins." });
  }
});

router.patch("/users/:id/role", verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ["user", "support", "manager", "admin"];
    if (!allowedRoles.includes(role))
      return res.status(400).json({ message: "Invalid role" });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("name username email role createdAt updatedAt isActive");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("[admin] Error updating user role:", err);
    res.status(500).json({ message: "Error updating user role" });
  }
});

/* =========================
   Dashboard Endpoint
========================= */
router.get("/dashboard", verifyAdmin, async (_req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersWeek,
      totalBookings,
      newBookingsWeek,
      confirmedBookings,
      pendingBookings,
      recentUsers,
      recentBookings,
      recentActivity,
      topXP,
      revenueAgg,
      totalXPAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Booking.countDocuments(),
      Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "pending" }),
      User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("name username email avatar xp createdAt")
        .lean(),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("flight travelers status total paidAt createdAt")
        .lean(),
      Notification.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .select("type title message createdAt")
        .lean(),
      User.find().sort({ xp: -1 }).limit(5).select("name username xp").lean(),
      Booking.aggregate([
        { $group: { _id: "$status", total: { $sum: "$total" } } },
      ]),
      User.aggregate([{ $group: { _id: null, totalXP: { $sum: "$xp" } } }]),
    ]);

    const revenueByStatus = {};
    let totalRevenue = 0;
    for (const r of revenueAgg) {
      revenueByStatus[r._id] = r.total || 0;
      if (r._id === "confirmed") totalRevenue = r.total || 0;
    }

    return res.json({
      ok: true,
      data: {
        stats: {
          totalUsers,
          newUsersWeek,
          totalBookings,
          newBookingsWeek,
          confirmedBookings,
          pendingBookings,
          totalRevenue,
          totalXP: totalXPAgg?.[0]?.totalXP || 0,
        },
        recentUsers,
        recentBookings,
        recentActivity,
        topXP,
        revenueByStatus,
      },
    });
  } catch (err) {
    console.error("[admin] Dashboard error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load dashboard" });
  }
});

export default router;
