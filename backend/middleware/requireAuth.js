import jwt from "jsonwebtoken";
import User from "../models/user.js";

function extractToken(req) {
  // 1. Cookie first (browser sessions)
  if (req.cookies?.token) return req.cookies.token;
  // 2. Bearer header fallback (mobile / API clients)
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ ok: false, message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid token payload" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ ok: false, message: "Account is inactive" });
    }

    if (typeof user.isSuspended === "function" && user.isSuspended()) {
      return res
        .status(403)
        .json({ ok: false, message: "Account is suspended" });
    }

    req.user = user; // full Mongoose doc — toSafeJSON() works here
    req.auth = { userId: user._id.toString(), role: user.role };

    return next();
  } catch (err) {
    console.error("[requireAuth] error:", err.message);
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token" });
  }
}

export default requireAuth;
