import { Router } from "express";
import Notification from "../../models/notification.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("Notifications fetch error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch notifications",
    });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );

    return res.json({
      ok: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    console.error("Notifications read-all error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to mark notifications as read",
    });
  }
});

export default router;