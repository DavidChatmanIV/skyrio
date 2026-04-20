import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { signToken, setAuthCookie, clearAuthCookie } from "./utils/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "username, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        message: "Username or email already in use",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      name: name?.trim() || "",
      passwordHash,
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      ok: true,
      message: "Account created successfully",
      user: user.toSafeJSON(),
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to register",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, email, username, password } = req.body;
    const loginValue = emailOrUsername || email || username;

    if (!loginValue || !password) {
      return res.status(400).json({
        ok: false,
        message: "Login and password are required",
      });
    }

    const normalizedLogin = String(loginValue).trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: normalizedLogin }, { username: normalizedLogin }],
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid credentials",
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        message: "Invalid credentials",
      });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Login successful",
      user: user.toSafeJSON(),
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to login",
    });
  }
});

router.post("/logout", async (_req, res) => {
  try {
    clearAuthCookie(res);
    return res.json({
      ok: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to logout",
    });
  }
});

router.get("/check", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    authenticated: true,
    user: req.user.toSafeJSON(),
  });
});

// ✅ GET /api/auth/available?username=xxx&email=xxx
router.get("/available", async (req, res) => {
  try {
    const { username, email } = req.query;

    if (!username && !email) {
      return res.status(400).json({
        ok: false,
        error: "Provide username and/or email",
      });
    }

    const result = {};

    if (username) {
      const normalized = String(username).trim().toLowerCase();
      const exists = await User.findOne({ username: normalized }).lean();
      result.username = { available: !exists };
    }

    if (email) {
      const normalized = String(email).trim().toLowerCase();
      const exists = await User.findOne({ email: normalized }).lean();
      result.email = { available: !exists };
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Available check error:", err);
    return res.status(500).json({
      ok: false,
      error: "Could not check availability",
    });
  }
});

export default router;