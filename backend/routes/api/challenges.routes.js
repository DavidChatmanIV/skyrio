import { Router } from "express";
import Challenge from "../../models/challenge.js";
import ChallengeProgress from "../../models/challengeProgress.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

function isAdmin(req) {
  return req.user?.role === "admin" || req.user?.isAdmin === true;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/challenges
   Returns every currently-running challenge (active, within its
   date window), along with this user's own progress on each —
   what the frontend Challenges tab actually renders.
───────────────────────────────────────────────────────────── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const challenges = await Challenge.find({
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ endDate: 1 })
      .lean();

    const userId = req.user._id;
    const progressDocs = challenges.length
      ? await ChallengeProgress.find({
          user: userId,
          challenge: { $in: challenges.map((c) => c._id) },
        }).lean()
      : [];
    const progressByChallenge = new Map(
      progressDocs.map((p) => [p.challenge.toString(), p])
    );

    const result = challenges.map((c) => {
      const p = progressByChallenge.get(c._id.toString());
      return {
        id: c._id,
        title: c.title,
        description: c.description,
        theme: c.theme,
        icon: c.icon,
        requirementCount: c.requirement.count,
        bonusXP: c.bonusXP,
        startDate: c.startDate,
        endDate: c.endDate,
        activated: !!p,
        progress: p?.progress ?? 0,
        completed: !!p?.completedAt,
      };
    });

    return res.json({ ok: true, challenges: result });
  } catch (err) {
    console.error("[challenges] list error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load challenges." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/challenges/:id/activate
   User opts in — creates the progress record that starts counting
   their actions toward this challenge.
───────────────────────────────────────────────────────────── */
router.post("/:id/activate", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const challenge = await Challenge.findOne({
      _id: id,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    if (!challenge) {
      return res
        .status(404)
        .json({ ok: false, message: "Challenge not found or not running." });
    }

    // Atomic upsert — activating twice (e.g. double-tap, two tabs) just
    // returns the existing record instead of erroring or duplicating it.
    const progress = await ChallengeProgress.findOneAndUpdate(
      { user: req.user._id, challenge: challenge._id },
      { $setOnInsert: { activatedAt: now } },
      { upsert: true, new: true }
    );

    return res.json({
      ok: true,
      activated: true,
      progress: progress.progress,
      completed: !!progress.completedAt,
    });
  } catch (err) {
    console.error("[challenges] activate error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to activate challenge." });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN CONTROL — create / edit / end early.
   No UI yet — call these directly (curl, Postman, etc.) until
   there's time to wrap a screen around them. Same admin check
   already established in bookings.routes.js.
───────────────────────────────────────────────────────────── */

// POST /api/challenges — create a new challenge
router.post("/", requireAuth, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ ok: false, message: "Admins only." });
  }
  try {
    const {
      title,
      description,
      theme,
      icon,
      requirement, // { actionType, count }
      bonusXP,
      startDate,
      endDate,
    } = req.body;

    if (
      !title ||
      !description ||
      !requirement?.actionType ||
      !requirement?.count
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "title, description, and requirement.{actionType,count} are required.",
      });
    }

    const challenge = await Challenge.create({
      title,
      description,
      theme,
      icon,
      requirement,
      bonusXP: bonusXP ?? 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    });

    return res.status(201).json({ ok: true, challenge });
  } catch (err) {
    console.error("[challenges] create error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create challenge." });
  }
});

// PATCH /api/challenges/:id — edit anything: bonus, dates, active flag,
// even swap which action it tracks. This is the "change my mind mid
// campaign" endpoint — no deploy needed for any of it.
router.patch("/:id", requireAuth, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ ok: false, message: "Admins only." });
  }
  try {
    const allowed = [
      "title",
      "description",
      "theme",
      "icon",
      "requirement",
      "bonusXP",
      "startDate",
      "endDate",
      "active",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!challenge) {
      return res
        .status(404)
        .json({ ok: false, message: "Challenge not found." });
    }
    return res.json({ ok: true, challenge });
  } catch (err) {
    console.error("[challenges] update error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to update challenge." });
  }
});

// DELETE /api/challenges/:id — end a challenge early. Sets active=false
// rather than hard-deleting, so existing progress/completion records
// (and anyone's already-awarded bonus XP) stay intact.
router.delete("/:id", requireAuth, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ ok: false, message: "Admins only." });
  }
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    );
    if (!challenge) {
      return res
        .status(404)
        .json({ ok: false, message: "Challenge not found." });
    }
    return res.json({ ok: true, message: "Challenge ended.", challenge });
  } catch (err) {
    console.error("[challenges] end error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to end challenge." });
  }
});

export default router;
