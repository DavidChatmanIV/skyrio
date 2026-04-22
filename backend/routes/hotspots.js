import express from "express";
import Booking from "../models/booking.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "4", 10), 10);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await Booking.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            city: "$destinationCity",
            country: "$destinationCountry",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    const max = rows[0]?.count || 1;

    const hotspots = rows.map((r) => {
      const city = r._id.city || "Unknown";
      const country = r._id.country || "";
      const ratio = r.count / max;
      const boost = Math.round(12 + ratio * 30);

      return {
        city,
        country,
        count: r.count,
        boostPercent: boost,
        tag: `#${String(city).replace(/\s+/g, "")}`,
      };
    });

    res.json({ hotspots, windowDays: 30 });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to build hotspots", error: e?.message });
  }
});

export default router;
