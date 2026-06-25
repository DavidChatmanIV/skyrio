import jwt from "jsonwebtoken";
import User from "../models/user.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
      return res
        .status(401)
        .json({ message: "Missing or invalid Authorization header" });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const userId = payload.sub || payload.id;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(401)
        .json({ message: "User no longer exists or was removed" });
    }

    // ✅ FIX: requireAuth.js (used everywhere else — rewards, XP, profile)
    // blocks suspended/deactivated users here; this middleware didn't,
    // meaning a banned user could still create real bookings and have
    // real Stripe charges go through while being correctly blocked from
    // everything else in the app. Mirrors requireAuth.js's checks exactly,
    // just written as plain field comparisons instead of calling
    // user.isSuspended() — that's an instance method defined on the
    // Mongoose schema, not available here since .lean() returns a plain
    // object with no methods attached.
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is inactive" });
    }
    const suspendedUntil = user.moderation?.suspendedUntil;
    if (suspendedUntil && new Date(suspendedUntil).getTime() > Date.now()) {
      return res.status(403).json({ message: "Account is suspended" });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      xp: user.xp,
      isOfficial: !!user.isOfficial,
      preferences: user.preferences || {},
    };

    next();
  } catch (err) {
    console.error("[authRequired] error:", err.message);

    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired, please log in again" });
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export default authRequired;
