import { Router } from "express";
import { User, Place, Admin } from "../models/index.js";
import { auth, verifyAdmin } from "../middleware/auth.js";

const router = Router();

// ✅ Test route
router.get("/", (_req, res) => {
  res.send("User route is working!");
});

// 🔐 GET: List all admins (superadmin-only)
router.get("/admins", verifyAdmin, async (_req, res) => {
  try {
    const admins = await Admin.find().select("email role");
    res.json(admins);
  } catch (err) {
    console.error("Failed to load admins:", err);
    res.status(500).json({ message: "Error loading admins." });
  }
});

// 🔐 GET: View saved trips
router.get("/saved-trips", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("savedTrips");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ savedTrips: user.savedTrips });
  } catch (err) {
    console.error("Failed to retrieve saved trips:", err);
    res.status(500).json({ message: "Server error retrieving saved trips." });
  }
});

// 💾 POST: Save a trip
router.post("/save-trip", auth, async (req, res) => {
  const { placeId } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const alreadySaved = user.savedTrips.some(
      (id) => id.toString() === placeId
    );
    if (alreadySaved) {
      return res.status(400).json({ message: "Trip already saved." });
    }

    user.savedTrips.push(placeId);
    await user.save();

    res.json({ message: "Trip saved successfully." });
  } catch (err) {
    console.error("Failed to save trip:", err);
    res.status(500).json({ message: "Server error saving trip." });
  }
});

// 🗑️ DELETE: Remove a saved trip
router.delete("/remove-trip/:id", auth, async (req, res) => {
  const { id: tripId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.savedTrips = user.savedTrips.filter((id) => id.toString() !== tripId);
    await user.save();

    res.json({ message: "Trip removed successfully." });
  } catch (err) {
    console.error("Failed to remove trip:", err);
    res.status(500).json({ message: "Server error removing trip." });
  }
});

export default router;
