// Home airport — the "closest airport to me" on a traveler's Digital
// Passport. Flight searches start here. Mount BEFORE your other
// /api/users routes:
//   import homeAirportRoutes from "./routes/homeAirport.routes.js";
//   app.use("/api/users", homeAirportRoutes);
//
//   GET    /api/users/me/home-airport   → { homeAirport: {code,city,name} | null }
//   PATCH  /api/users/me/home-airport   { code, city?, name? }
//   DELETE /api/users/me/home-airport   → clears it
import { Router } from "express";
import User from "../models/user.js";
import authRequired from "../middleware/authRequired.js";

const router = Router();

const clean = (v, max = 120) =>
  String(v ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);

const shape = (h) =>
  h?.code ? { code: h.code, city: h.city, name: h.name } : null;

router.get("/me/home-airport", authRequired, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select("homeAirport").lean();
    if (!u) return res.status(404).json({ message: "Account not found." });
    res.json({ homeAirport: shape(u.homeAirport) });
  } catch (err) {
    console.error("GET /api/users/me/home-airport error:", err);
    res.status(500).json({ message: "Couldn't load your home airport." });
  }
});

router.patch("/me/home-airport", authRequired, async (req, res) => {
  try {
    const code = clean(req.body?.code, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return res
        .status(400)
        .json({ message: "Pick an airport from the list (3-letter code)." });
    }
    const city = clean(req.body?.city) || code;
    const name = clean(req.body?.name) || city;
    const u = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { homeAirport: { code, city, name } } },
      { new: true, runValidators: true }
    )
      .select("homeAirport")
      .lean();
    if (!u) return res.status(404).json({ message: "Account not found." });
    res.json({ ok: true, homeAirport: shape(u.homeAirport) });
  } catch (err) {
    console.error("PATCH /api/users/me/home-airport error:", err);
    res.status(500).json({ message: "Couldn't save your home airport." });
  }
});

router.delete("/me/home-airport", authRequired, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user.id },
      { $set: { homeAirport: { code: null, city: null, name: null } } }
    );
    res.json({ ok: true, homeAirport: null });
  } catch (err) {
    console.error("DELETE /api/users/me/home-airport error:", err);
    res.status(500).json({ message: "Couldn't clear your home airport." });
  }
});

export default router;
