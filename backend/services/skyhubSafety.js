// backend/services/skyhubSafety.js
// ─────────────────────────────────────────────────────────────
// SkyHub safety helpers:
//   • who's calling (reads the same login token the rest of Skyrio uses)
//   • rate limits (how often someone can post, comment, like, report)
//   • spam checks (links, repeats, image hosts)
//   • blocks and suspensions
// ─────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.js";
import SkyHubPost from "../models/SkyHubPost.js";
import SkyHubBlock from "../models/SkyHubBlock.js";
import SkyHubRestriction from "../models/SkyHubRestriction.js";

// ── Who's calling ──────────────────────────────────────────────
function tokenFrom(req) {
  const header = req.headers?.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.cookies?.token || null;
}

// Attaches req.skyUser = { id, name, username, avatar, verified } when the
// request carries a valid login. Never blocks — the feed is public.
export async function readViewer(req, _res, next) {
  try {
    if (req.user?._id || req.user?.id) {
      const id = String(req.user._id || req.user.id);
      if (mongoose.isValidObjectId(id)) req.skyUserId = id;
    } else {
      const token = tokenFrom(req);
      if (token && process.env.JWT_SECRET) {
        const d = jwt.verify(token, process.env.JWT_SECRET);
        const id = String(
          d.userId || d.id || d._id || d.sub || d.user?.id || d.user?._id || ""
        );
        if (mongoose.isValidObjectId(id)) req.skyUserId = id;
      }
    }
    if (req.skyUserId) {
      const u = await User.findById(req.skyUserId)
        .select(
          "name username avatar profilePicture verified verifiedTier isActive role isAdmin"
        )
        .lean();
      if (u && u.isActive !== false) {
        req.skyUser = {
          id: String(u._id),
          name: u.name || u.username || "Traveler",
          username: u.username || "traveler",
          avatar: u.avatar || u.profilePicture || null,
          verified: Boolean(u.verified || u.verifiedTier),
          isAdmin: u.role === "admin" || u.isAdmin === true,
        };
      } else {
        req.skyUserId = null;
      }
    }
  } catch {
    req.skyUserId = null; // expired/invalid token → treated as signed out
  }
  next();
}

export function requireViewer(req, res, next) {
  if (!req.skyUser) {
    return res.status(401).json({ message: "Please log in to do that." });
  }
  next();
}

// ── Rate limits ────────────────────────────────────────────────
// In-memory sliding windows — fine for one server (Render). If you ever
// run several servers, move this to Redis.
const LIMITS = {
  post: [
    { max: 5, ms: 10 * 60 * 1000 },
    { max: 25, ms: 24 * 60 * 60 * 1000 },
  ],
  comment: [
    { max: 20, ms: 10 * 60 * 1000 },
    { max: 200, ms: 24 * 60 * 60 * 1000 },
  ],
  react: [{ max: 150, ms: 10 * 60 * 1000 }], // likes + saves
  report: [{ max: 15, ms: 60 * 60 * 1000 }],
  block: [{ max: 30, ms: 60 * 60 * 1000 }],
  upload: [{ max: 30, ms: 60 * 60 * 1000 }],
};
const hits = new Map(); // `${action}:${userId}` → [timestamps]

export function rateLimit(action) {
  return (req, res, next) => {
    const who = req.skyUser?.id || req.user?.id || req.user?._id || req.ip;
    const key = `${action}:${who}`;
    const now = Date.now();
    const rules = LIMITS[action] || [];
    const longest = Math.max(...rules.map((r) => r.ms), 0);
    const list = (hits.get(key) || []).filter((t) => now - t < longest);
    for (const r of rules) {
      const inWindow = list.filter((t) => now - t < r.ms).length;
      if (inWindow >= r.max) {
        const oldest = list.filter((t) => now - t < r.ms)[0];
        const waitMin = Math.max(1, Math.ceil((r.ms - (now - oldest)) / 60000));
        return res.status(429).json({
          message: `You're doing that a lot. Try again in about ${waitMin} minute${
            waitMin === 1 ? "" : "s"
          }.`,
        });
      }
    }
    list.push(now);
    hits.set(key, list);
    next();
  };
}
// Keep memory tidy.
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) {
    const fresh = list.filter((t) => now - t < 24 * 60 * 60 * 1000);
    if (fresh.length) hits.set(k, fresh);
    else hits.delete(k);
  }
}, 30 * 60 * 1000).unref?.();

// ── Spam and content checks ────────────────────────────────────
const LINK_RE = /(https?:\/\/|www\.)\S+/gi;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g;

export function cleanText(s, max) {
  return String(s || "")
    .replace(CONTROL_RE, "")
    .trim()
    .slice(0, max);
}

export function checkSpam(text, { maxLinks = 2 } = {}) {
  const links = (text.match(LINK_RE) || []).length;
  if (links > maxLinks) return `Posts can include up to ${maxLinks} links.`;
  if (/(.)\1{14,}/.test(text))
    return "That looks like spam. Please edit and try again.";
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 40 && letters === letters.toUpperCase()) {
    return "Please don't write the whole post in capital letters.";
  }
  return null;
}

export async function isRepeatPost(userId, text) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const same = await SkyHubPost.exists({
    author: userId,
    text,
    createdAt: { $gte: since },
  });
  return Boolean(same);
}

// Only photos uploaded through Skyrio can be attached:
//   • Cloudinary:   https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/...
//   • Our own server's /uploads/ folder (relative "/uploads/..." or a full
//     link on this API's own host, e.g. http://localhost:4000/uploads/...)
// Anything else is dropped, and the reason is logged so a "missing photo"
// is never a mystery again.
const OWN_HOSTS = [
  process.env.PUBLIC_API_URL,
  process.env.API_URL,
  process.env.BACKEND_URL,
]
  .filter(Boolean)
  .map((u) => {
    try {
      return new URL(u).host;
    } catch {
      return null;
    }
  })
  .filter(Boolean);

function isOwnUploadPath(pathname) {
  return pathname.startsWith("/uploads/") && !pathname.includes("..");
}

function imageUrlProblem(u) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  // Relative link to our own uploads folder.
  if (u.startsWith("/"))
    return isOwnUploadPath(u) ? null : "relative link outside /uploads/";
  let url;
  try {
    url = new URL(u);
  } catch {
    return "not a valid link";
  }
  if (url.hostname === "res.cloudinary.com") {
    if (url.protocol !== "https:") return "Cloudinary link isn't https";
    if (cloud && !url.pathname.startsWith(`/${cloud}/`)) {
      return `Cloudinary account doesn't match CLOUDINARY_CLOUD_NAME (${cloud})`;
    }
    return null;
  }
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (OWN_HOSTS.includes(url.host) || isLocalDev) &&
    isOwnUploadPath(url.pathname)
  ) {
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
      return "own upload isn't https";
    return null;
  }
  return `host ${url.hostname} isn't Cloudinary or this server`;
}

export function safeImageUrls(list, max = 4) {
  return (Array.isArray(list) ? list : [])
    .filter((u) => typeof u === "string" && u.trim())
    .map((u) => u.trim())
    .filter((u) => {
      const problem = imageUrlProblem(u);
      if (problem)
        console.warn(`[skyhub] photo dropped (${problem}): ${u.slice(0, 160)}`);
      return !problem;
    })
    .slice(0, max);
}

export function cleanTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .map((t) =>
      cleanText(t, 30)
        .replace(/^#/, "")
        .replace(/[^\p{L}\p{N}_ -]/gu, "")
    )
    .filter(Boolean)
    .slice(0, 6);
}

// ── Blocks ─────────────────────────────────────────────────────
// Everyone this viewer shouldn't see: people they blocked + people who blocked them.
export async function hiddenAuthorIds(viewerId) {
  if (!viewerId) return [];
  const rows = await SkyHubBlock.find({
    $or: [{ blocker: viewerId }, { blocked: viewerId }],
  })
    .select("blocker blocked")
    .lean();
  const ids = new Set();
  for (const r of rows) {
    ids.add(
      String(String(r.blocker) === String(viewerId) ? r.blocked : r.blocker)
    );
  }
  return [...ids];
}

export async function isBlockedBetween(a, b) {
  if (!a || !b) return false;
  return Boolean(
    await SkyHubBlock.exists({
      $or: [
        { blocker: a, blocked: b },
        { blocker: b, blocked: a },
      ],
    })
  );
}

// ── Suspensions ────────────────────────────────────────────────
export async function suspensionFor(userId) {
  if (!userId) return null;
  const r = await SkyHubRestriction.findOne({ user: userId }).lean();
  if (!r) return null;
  if (r.until && new Date(r.until) <= new Date()) {
    await SkyHubRestriction.deleteOne({ _id: r._id }).catch(() => {});
    return null;
  }
  return r;
}

export async function requireNotSuspended(req, res, next) {
  const s = await suspensionFor(req.skyUser?.id);
  if (s) {
    const permanent = s.permanent || !s.until;
    const when = s.until
      ? ` until ${new Date(s.until).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`
      : "";
    return res.status(403).json({
      paused: true,
      message: permanent
        ? "Your SkyHub account is suspended for breaking the community guidelines. You can still search and book trips."
        : `Your SkyHub account is paused${when} for breaking the community guidelines. You can still search and book trips.`,
    });
  }
  next();
}

// Posts auto-hide for review once this many different people report them.
export const AUTO_HIDE_REPORTS = 3;
