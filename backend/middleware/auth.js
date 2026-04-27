import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { requireAuth } from "./requireAuth.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const ADMIN_COOKIE_NAME = "skyrio_admin";

// Re-export requireAuth as the canonical authRequired for backward compatibility
export { requireAuth as authRequired };
export const auth = requireAuth;

function getTokenFromHeader(req) {
  const authHeader =
    req.headers.authorization || req.header("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function getAdminTokenFromCookie(req) {
  return req.cookies?.[ADMIN_COOKIE_NAME] || null;
}

function safeVerify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");

export async function verifyAdmin(req, res, next) {
  try {
    const adminCookie = getAdminTokenFromCookie(req);
    if (adminCookie) {
      const decoded = safeVerify(adminCookie);
      if (decoded?.isAdmin) {
        req.admin = decoded;
        return next();
      }
      return res.status(401).json({ message: "Invalid admin session" });
    }

    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = safeVerify(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (decoded.role === "admin") {
      req.admin = decoded;
      return next();
    }

    if (decoded.id) {
      const user = await User.findById(decoded.id)
        .select("role isActive email username")
        .lean();

      if (!user || user.isActive === false) {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      if (user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden — Admins only" });
      }

      req.admin = {
        id: decoded.id,
        role: "admin",
        email: user.email,
        username: user.username,
      };
      return next();
    }

    return res.status(403).json({ message: "Forbidden — Admins only" });
  } catch (err) {
    console.error("verifyAdmin error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
