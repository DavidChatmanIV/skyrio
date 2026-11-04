// backend/routes/thanks.routes.js
// "Thank you for your feedback / review" from the admin dashboard.
//
//   POST /api/feedback/admin/thank      { ids, message, notify, email, resend }
//   POST /api/testimonials/admin/thank  { ids, message, notify, email, resend }
//
// resend: true also includes items that were already thanked (to resend
// an email that didn't arrive). Without it, already-thanked items are
// skipped.
//
// Works on anything already submitted, old or new. Sends ONE message per
// person (someone with 4 submissions isn't thanked 4 times), then stamps
// thankedAt on every item so nobody is thanked twice.
//
// Mounted in server.js BEFORE the main API router:
//   import thanksRoutes from "./routes/thanks.routes.js";
//   app.use("/api", thanksRoutes);
import { Router } from "express";
import mongoose from "mongoose";
import authRequired from "../middleware/authRequired.js";
import { readAdminSession } from "./admin.routes.js";
import { sendThankYou } from "../services/thankYou.js";

const router = Router();

// The Feedback / Testimonial / AdminAudit models are registered by the
// feedback routes at startup, so they're looked up by name here instead of
// importing the model file (no path to get wrong).
const M = (name) => mongoose.models[name] || mongoose.model(name);

// Same two ways to be an admin as the rest of the dashboard:
// the admin-dashboard session, or a Skyrio login with role "admin".
const isAdminUser = (req) =>
  req.user?.role === "admin" || req.user?.isAdmin === true;
function adminOnly(req, res, next) {
  const admin = readAdminSession(req);
  if (admin) {
    req.adminEmail = admin.email;
    return next();
  }
  return authRequired(req, res, () =>
    isAdminUser(req)
      ? ((req.adminEmail = req.user?.email || "admin"), next())
      : res.status(403).json({ message: "Admin access required." })
  );
}

function handler(modelName, kind) {
  return async (req, res) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map(String)
      .filter((id) => mongoose.isValidObjectId(id))
      .slice(0, 500);
    const message = String(req.body?.message || "")
      .trim()
      .slice(0, 600);
    const notify = req.body?.notify !== false;
    const email = req.body?.email !== false;
    const resend = req.body?.resend === true;
    if (!ids.length)
      return res.status(400).json({ ok: false, message: "Nothing selected." });
    if (!message)
      return res
        .status(400)
        .json({ ok: false, message: "Write a message first." });
    if (!notify && !email)
      return res
        .status(400)
        .json({ ok: false, message: "Pick notification, email, or both." });

    try {
      const Model = M(modelName);
      const items = await Model.find({
        _id: { $in: ids },
        user: { $ne: null },
        ...(resend ? {} : { thankedAt: { $exists: false } }),
      })
        .select("_id user")
        .lean();

      // One message per person.
      const byUser = new Map();
      for (const it of items) {
        const uid = String(it.user);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(it._id);
      }

      let people = 0;
      const thankedIds = [];
      const emailFailed = []; // people whose email didn't go out
      const now = new Date();
      for (const [uid, itemIds] of byUser) {
        try {
          const r = await sendThankYou({
            user: uid,
            kind,
            message,
            notify,
            email,
          });
          if (email && !r.emailed) {
            emailFailed.push({
              name: r.name || null,
              email: r.to || null,
              reason: r.emailError || "No email on file",
            });
          }
          if (r.notified || r.emailed) {
            people += 1;
            thankedIds.push(...itemIds);
            // strict:false so this works even before these fields are in
            // the schema. thankEmailed shows in the dashboard so a missed
            // email is easy to spot and resend.
            const set = {
              thankedAt: now,
              thankedBy: req.adminEmail || "admin",
            };
            if (email) {
              set.thankEmailed = Boolean(r.emailed);
              if (r.emailed) set.thankEmailedAt = now;
            }
            await Model.updateMany(
              { _id: { $in: itemIds } },
              { $set: set },
              { strict: false }
            );
          }
        } catch (err) {
          console.warn(`[thanks] ${kind} → user ${uid} failed:`, err?.message);
        }
      }

      if (thankedIds.length) {
        try {
          await M("AdminAudit").create({
            admin: req.adminEmail || "admin",
            action: "thank",
            target: { kind },
            detail: `${resend ? "Re-sent thanks to" : "Thanked"} ${people} ${
              people === 1 ? "person" : "people"
            } for ${thankedIds.length} ${
              kind === "review" ? "review" : "feedback"
            } item(s)`,
          });
        } catch {
          /* audit is best-effort */
        }
      }

      res.json({
        ok: true,
        people,
        items: thankedIds.length,
        skipped: ids.length - thankedIds.length,
        emailFailed,
      });
    } catch (err) {
      console.error(`POST /${kind} thank error:`, err);
      res.status(500).json({ ok: false, message: "Couldn't send thank-yous." });
    }
  };
}

router.post(
  "/feedback/admin/thank",
  adminOnly,
  handler("Feedback", "feedback")
);
router.post(
  "/testimonials/admin/thank",
  adminOnly,
  handler("Testimonial", "review")
);

export default router;
