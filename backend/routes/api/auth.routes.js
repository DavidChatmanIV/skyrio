import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { signToken, setAuthCookie, clearAuthCookie } from "./utils/auth.js";

const router = Router();

// ── Nodemailer helper ──────────────────────────────────
function createMailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

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

    // ── Send verification email async (don't block registration) ──
    const verifyToken = crypto.randomBytes(32).toString("hex");
    user.emailVerifyToken = verifyToken;
    user.emailVerifyExpiry = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    createMailer()
      .sendMail({
        from: `"Skyrio" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Verify your Skyrio email",
        html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#09071a;color:#fff;border-radius:16px">
          <h2 style="color:#ff8a2a;margin-bottom:8px">Verify your email ✈️</h2>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">
            Click below to verify your Skyrio account. This link expires in <strong>24 hours</strong>.
          </p>
          <a href="${verifyUrl}"
            style="background:linear-gradient(135deg,#ff8a2a,#ffb066);color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:700;font-size:15px">
            ✈️ Verify Email
          </a>
          <p style="margin-top:32px;color:rgba(255,255,255,0.3);font-size:12px">
            If you didn't create a Skyrio account, ignore this email.
          </p>
        </div>
      `,
      })
      .catch((err) => console.error("Verification email failed:", err));

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
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ ok: false, message: "Account is inactive" });
    }

    if (typeof user.isSuspended === "function" && user.isSuspended()) {
      return res
        .status(403)
        .json({ ok: false, message: "Account is suspended" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
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
    return res.status(500).json({ ok: false, message: "Failed to login" });
  }
});

router.post("/logout", async (_req, res) => {
  try {
    clearAuthCookie(res);
    return res.json({ ok: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ ok: false, message: "Failed to logout" });
  }
});

router.get("/check", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    authenticated: true,
    user: req.user.toSafeJSON(),
  });
});

router.get("/available", async (req, res) => {
  try {
    const { username, email } = req.query;

    if (!username && !email) {
      return res
        .status(400)
        .json({ ok: false, error: "Provide username and/or email" });
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
    return res
      .status(500)
      .json({ ok: false, error: "Could not check availability" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, message: "Email required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.json({
        ok: true,
        message: "If that email exists, a reset link was sent.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset?token=${token}`;

    await createMailer().sendMail({
      from: `"Skyrio" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset your Skyrio password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#09071a;color:#fff;border-radius:16px">
          <h2 style="color:#ff8a2a;margin-bottom:8px">Reset your password</h2>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">
            Click the button below to reset your Skyrio password. This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}"
            style="background:linear-gradient(135deg,#ff8a2a,#ffb066);color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:700;font-size:15px">
            ✈️ Reset Password
          </a>
          <p style="margin-top:32px;color:rgba(255,255,255,0.3);font-size:12px">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return res.json({
      ok: true,
      message: "If that email exists, a reset link was sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to send reset email" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ ok: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or expired reset link" });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.json({ ok: true, message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to reset password" });
  }
});

// ── Send verification email ────────────────────────────
router.post("/send-verification", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.emailVerified) {
      return res.json({ ok: true, message: "Email already verified" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.emailVerifyToken = token;
    user.emailVerifyExpiry = Date.now() + 1000 * 60 * 60 * 24;
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await createMailer().sendMail({
      from: `"Skyrio" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Verify your Skyrio email",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#09071a;color:#fff;border-radius:16px">
          <h2 style="color:#ff8a2a;margin-bottom:8px">Verify your email</h2>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">
            Click below to verify your Skyrio account. This link expires in <strong>24 hours</strong>.
          </p>
          <a href="${verifyUrl}"
            style="background:linear-gradient(135deg,#ff8a2a,#ffb066);color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:700;font-size:15px">
            ✈️ Verify Email
          </a>
          <p style="margin-top:32px;color:rgba(255,255,255,0.3);font-size:12px">
            If you didn't create a Skyrio account, ignore this email.
          </p>
        </div>
      `,
    });

    return res.json({ ok: true, message: "Verification email sent" });
  } catch (err) {
    console.error("Send verification error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to send verification email" });
  }
});

// ── Confirm email token ────────────────────────────────
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ ok: false, message: "Token required" });
    }

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or expired verification link" });
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpiry = undefined;
    await user.save();

    return res.json({ ok: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ ok: false, message: "Verification failed" });
  }
});

export default router;
