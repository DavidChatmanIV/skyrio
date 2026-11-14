// Disruption mode routes.
//   GET  /api/site-status                     public: the live alert (banner, booking pages)
//   GET  /api/admin/site-status               admin: full alert + history
//   PUT  /api/admin/site-status               admin: post or edit the alert
//   POST /api/admin/site-status/clear         admin: turn it off (pauses end too)
//   POST /api/admin/site-status/notify        admin: { hours, verticals, airports, dryRun }

import { Router } from "express";
import { verifyAdmin } from "./admin.routes.js";
import {
  getSiteStatus,
  publicView,
  validateAlert,
  setSiteStatus,
  clearSiteStatus,
  notifyAffectedTravelers,
} from "../services/siteStatus.js";

export const publicSiteStatus = Router();
publicSiteStatus.get("/", async (_req, res) => {
  try {
    const s = await getSiteStatus();
    res.set("Cache-Control", "public, max-age=15");
    res.json({ ok: true, ...publicView(s) });
  } catch (err) {
    console.error("[site-status] read failed:", err.message);
    // Fail quiet: no banner beats a broken page.
    res.json({ ok: true, active: false });
  }
});

const admin = Router();
admin.use(verifyAdmin);
const who = (req) => req.admin?.email || req.admin?.id || "admin";

admin.get("/", async (_req, res) => {
  try {
    const s = await getSiteStatus({ fresh: true });
    res.json({
      ok: true,
      status: s
        ? {
            ...publicView(s),
            active: Boolean(s.active),
            raw: {
              kind: s.kind,
              severity: s.severity,
              title: s.title,
              message: s.message,
              areas: s.areas,
              affects: s.affects,
              pause: s.pause,
            },
            startedAt: s.startedAt,
            updatedBy: s.updatedBy,
            emailed: (s.notifiedBookingIds || []).length,
            history: (s.history || []).slice(0, 10),
          }
        : { active: false, history: [] },
    });
  } catch (err) {
    console.error("[site-status] admin read failed:", err.message);
    res.status(500).json({ ok: false, message: "Couldn't load the alert. Try again." });
  }
});

admin.put("/", async (req, res) => {
  const { value, error } = validateAlert(req.body);
  if (error) return res.status(400).json({ ok: false, message: error });
  try {
    const s = await setSiteStatus(value, who(req));
    res.json({ ok: true, status: publicView(s) });
  } catch (err) {
    console.error("[site-status] save failed:", err.message);
    res.status(500).json({ ok: false, message: "Couldn't post the alert. Try again." });
  }
});

admin.post("/clear", async (req, res) => {
  try {
    await clearSiteStatus(who(req));
    res.json({ ok: true });
  } catch (err) {
    console.error("[site-status] clear failed:", err.message);
    res.status(500).json({ ok: false, message: "Couldn't clear the alert. Try again." });
  }
});

admin.post("/notify", async (req, res) => {
  try {
    const { hours = 48, verticals = ["flights"], airports = "", dryRun = true } = req.body || {};
    const out = await notifyAffectedTravelers({
      hours,
      verticals: Array.isArray(verticals) ? verticals : [],
      airports: String(airports || "").slice(0, 120),
      dryRun: dryRun !== false,
      by: who(req),
    });
    if (!out.ok) return res.status(400).json({ ok: false, message: out.error });
    res.json(out);
  } catch (err) {
    console.error("[site-status] notify failed:", err.message);
    res.status(500).json({ ok: false, message: "Couldn't email travelers. Try again." });
  }
});

export default admin;
