import jwt from "jsonwebtoken";
import User from "../models/user.js";

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

export async function requireAuth(req, res, next) {
  try {
    const cookieToken = req.cookies?.token || null;
    const bearerToken = getBearerToken(req);
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User not found",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        ok: false,
        message: "Account is inactive",
      });
    }

    if (typeof user.isSuspended === "function" && user.isSuspended()) {
      return res.status(403).json({
        ok: false,
        message: "Account is suspended",
      });
    }

    req.user = user;
    req.auth = {
      userId: user._id.toString(),
      role: user.role,
    };

    return next();
  } catch (err) {
    console.error("requireAuth error:", err.message);

    return res.status(401).json({
      ok: false,
      message: "Invalid or expired token",
    });
  }
}

export default requireAuth;