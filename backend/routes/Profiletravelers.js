// Saved travelers + lead traveler details for checkout autofill.
// Standalone router: mounted in server.js next to your other routes with
//   import profileTravelersRoutes from "./routes/profileTravelers.js";
//   app.use("/api/profile", profileTravelersRoutes);
// which gives:
//   PUT    /api/profile/travelers
//   DELETE /api/profile/travelers/:id

import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const router = express.Router();

// Reads the same "Authorization: Bearer <token>" header the checkout
// sends. Uses process.env.JWT_SECRET — if your login code signs tokens
// with a differently named env var, change it here.
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
      return res.status(401).json({ ok: false, message: "Not signed in" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId =
      decoded.id ||
      decoded.userId ||
      decoded._id ||
      decoded.user?.id ||
      decoded.sub;
    if (!userId)
      return res.status(401).json({ ok: false, message: "Invalid token" });
    req.travelerUserId = userId;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Not signed in" });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SAVED = 12;
const clean = (s) => (typeof s === "string" ? s.trim() : "");
const sameTraveler = (a, b) =>
  clean(a.firstName).toLowerCase() === clean(b.firstName).toLowerCase() &&
  clean(a.lastName).toLowerCase() === clean(b.lastName).toLowerCase() &&
  a.dob === b.dob;

// PUT /api/profile/travelers
// body: { lead: { dob, gender, phone, hasPet } | null,
//         travelers: [{ _id?, firstName, lastName, dob, gender, type, hasPet }] }
router.put("/travelers", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.travelerUserId);
    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });

    const { lead, travelers } = req.body || {};

    if (lead && typeof lead === "object") {
      const prev = user.leadTraveler || {};
      user.leadTraveler = {
        dob: DATE_RE.test(lead.dob || "") ? lead.dob : prev.dob,
        gender: ["M", "F"].includes(lead.gender)
          ? lead.gender
          : prev.gender || "",
        phone: /^\+\d{6,15}$/.test(lead.phone || "") ? lead.phone : prev.phone,
        hasPet: !!lead.hasPet,
      };
    }

    if (Array.isArray(travelers)) {
      for (const t of travelers.slice(0, MAX_SAVED)) {
        if (
          !clean(t.firstName) ||
          !clean(t.lastName) ||
          !DATE_RE.test(t.dob || "")
        )
          continue;
        const data = {
          firstName: clean(t.firstName),
          lastName: clean(t.lastName),
          dob: t.dob,
          gender: ["M", "F"].includes(t.gender) ? t.gender : "",
          type: ["ADT", "CHD", "INF"].includes(t.type) ? t.type : "ADT",
          hasPet: !!t.hasPet,
        };
        // Update by id, else by same name + DOB, else add.
        const existing =
          (t._id && user.savedTravelers.id(t._id)) ||
          user.savedTravelers.find((s) => sameTraveler(s, data));
        if (existing) existing.set(data);
        else if (user.savedTravelers.length < MAX_SAVED)
          user.savedTravelers.push(data);
      }
    }

    await user.save();
    res.json({
      ok: true,
      leadTraveler: user.leadTraveler,
      savedTravelers: user.savedTravelers,
    });
  } catch (err) {
    console.error("[profile/travelers] save failed:", err);
    res.status(500).json({ ok: false, message: "Could not save travelers" });
  }
});

// DELETE /api/profile/travelers/:id — for a future "Saved travelers"
// section in profile settings, so people can remove someone.
router.delete("/travelers/:id", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.travelerUserId);
    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });
    const t = user.savedTravelers.id(req.params.id);
    if (t) t.deleteOne();
    await user.save();
    res.json({ ok: true, savedTravelers: user.savedTravelers });
  } catch (err) {
    console.error("[profile/travelers] delete failed:", err);
    res.status(500).json({ ok: false, message: "Could not remove traveler" });
  }
});

export default router;
