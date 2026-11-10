import { Router } from "express";
import User from "../../models/user.js";
import { authRequired, requireRole } from "../../middleware/auth.js";

const router = Router();

/**
 * GET /api/admin/users
 * Supports: ?search= &page= &limit=
 * Access: admin, manager
 */
router.get(
  "/",
  authRequired,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page || "1", 10);
      const limit = parseInt(req.query.limit || "20", 10);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();

      const filter = {};
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ];
      }

      const [items, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("username name email role isActive createdAt updatedAt")
          .lean(),
        User.countDocuments(filter),
      ]);

      res.json({ items, total, page, limit });
    } catch (err) {
      console.error("GET /api/admin/users error:", err);
      res.status(500).json({ message: "Couldn't load users. Try again." });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/role
 * Updates user role
 * Access: admin, manager
 */
router.patch(
  "/:id/role",
  authRequired,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const { role } = req.body;

      const allowedRoles = ["user", "support", "manager", "admin"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true }
      ).select("username name email role isActive updatedAt");

      if (!user) return res.status(404).json({ message: "User not found" });

      res.json(user);
    } catch (err) {
      console.error("PATCH /api/admin/users/:id/role error:", err);
      res.status(500).json({ message: "Couldn't update role. Try again." });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/status
 * Toggles user active/inactive
 * Access: admin, manager
 */
router.patch(
  "/:id/status",
  authRequired,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: !!isActive },
        { new: true }
      ).select("username name email role isActive updatedAt");

      if (!user) return res.status(404).json({ message: "User not found" });

      res.json(user);
    } catch (err) {
      console.error("PATCH /api/admin/users/:id/status error:", err);
      res.status(500).json({ message: "Couldn't update status. Try again." });
    }
  }
);

export default router;