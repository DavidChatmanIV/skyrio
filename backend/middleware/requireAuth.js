import jwt from "jsonwebtoken";
import User from "../models/user.js";

export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
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

    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired token",
    });
  }
}

export default requireAuth;