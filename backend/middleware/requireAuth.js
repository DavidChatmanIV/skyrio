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

// Covers the common payload shapes (top-level and nested under
// `user` / `sub`).
function userIdFrom(decoded) {
  return (
    decoded.userId ||
    decoded.id ||
    decoded._id ||
    decoded.sub ||
    decoded.user?.id ||
    decoded.user?._id ||
    decoded.uid
  );
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
    const userId = userIdFrom(decoded);

    if (!userId) {
      console.error(
        "[requireAuth] token verified but no recognizable userId field. Decoded payload:",
        decoded
      );
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

// For routes guests can use too (flight and hotel checkout).
// Signed in → req.user is set, same as requireAuth.
// No token, or a bad/expired one → continues as a guest (req.user unset).
// Inactive or suspended accounts are still blocked.
export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  let user = null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = userIdFrom(decoded);
    if (userId) user = await User.findById(userId);
  } catch {
    // Expired/invalid login token shouldn't stop someone booking as a guest.
    return next();
  }
  if (!user) return next();

  if (user.isActive === false) {
    return res.status(403).json({ ok: false, message: "Account is inactive" });
  }
  if (typeof user.isSuspended === "function" && user.isSuspended()) {
    return res.status(403).json({ ok: false, message: "Account is suspended" });
  }

  req.user = user;
  req.auth = { userId: user._id.toString(), role: user.role };
  return next();
}

export default requireAuth;
