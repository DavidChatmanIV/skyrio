import { Router } from "express";
import Notification from "../../models/notification.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /api/notifications  (used by Notifications.jsx)
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = notifications.filter((n) => !n.read).length;
    return res.json({ ok: true, notifications, unreadCount });
  } catch (err) {
    console.error("Notifications fetch error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch notifications" });
  }
});

// GET /api/notifications/mine  (used by NotificationsBell.jsx)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    const unread = notifications.filter((n) => !n.read).length;

    // NotificationsBell expects { unread, items[] } with isRead field
    const items = notifications.map((n) => ({
      ...n.toObject(),
      isRead: n.read,
    }));

    return res.json({ ok: true, unread, items });
  } catch (err) {
    console.error("Notifications/mine fetch error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/read-all  ← must be before /:id
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );
    return res.json({ ok: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Notifications read-all error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to mark as read" });
  }
});

// DELETE /api/notifications/clear  ← must be before /:id
router.delete("/clear", requireAuth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    return res.json({ ok: true, message: "All notifications cleared" });
  } catch (err) {
    console.error("Notifications clear error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to clear notifications" });
  }
});

// PATCH /api/notifications/:id/read  (mark single as read)
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notif)
      return res.status(404).json({ ok: false, message: "Not found" });
    return res.json({ ok: true, notification: notif });
  } catch (err) {
    console.error("Notification mark-read error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to mark as read" });
  }
});

// DELETE /api/notifications/:id  (delete single)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notif)
      return res.status(404).json({ ok: false, message: "Not found" });
    return res.json({ ok: true, message: "Notification deleted" });
  } catch (err) {
    console.error("Notification delete error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete notification" });
  }
});

export default router;
