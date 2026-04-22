import express from "express";
import Watch from "../models/watch.js";

const router = express.Router();

function getUserId(req) {
  return req.user?.id || req.user?._id;
}

router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      type = "flights",
      destination = "",
      dates = null,
      guests = "",
      lastSeenPrice = null,
    } = req.body || {};

    const watch = await Watch.create({
      userId,
      type,
      destination,
      dates,
      guests,
      lastSeenPrice,
      active: true,
    });

    return res.status(201).json({ watch });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create watch" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const watches = await Watch.find({ userId, active: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ watches });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch watches" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const updated = await Watch.findOneAndUpdate(
      { _id: req.params.id, userId },
      { active: false },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to remove watch" });
  }
});

export default router;
