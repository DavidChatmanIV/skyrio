// Admin-only routes for the dashboard's "Alerts" tab.
// Mount in routes/api/index.js, on the line ABOVE the "/admin" mount:
//   await mount("/admin/alert-contacts", "../adminAlerts.js");
//
// Every route here is admin-only, using the same verifyAdmin check as the
// rest of /api/admin (signed admin cookie; x-admin-email header in dev only).

import { Router } from "express";
import AdminAlertContact from "../models/AdminAlertContact.js";
import { sendSms, toE164, ALERT_KEYS } from "../utils/notifyAdmins.js";
import { verifyAdmin } from "./admin.routes.js";

const router = Router();
router.use(verifyAdmin);

/** Keep only the fields an admin is allowed to set. */
function cleanBody(body = {}, { partial = false } = {}) {
  const out = {};
  if (body.label !== undefined) out.label = String(body.label).slice(0, 40);
  if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);
  if (body.phone !== undefined || !partial) {
    const phone = toE164(body.phone);
    if (!phone) {
      const err = new Error("Use a 10-digit US number like 201-555-1234.");
      err.status = 400;
      throw err;
    }
    out.phone = phone;
  }
  if (body.alerts && typeof body.alerts === "object") {
    for (const key of ALERT_KEYS) {
      if (body.alerts[key] !== undefined) {
        out[`alerts.${key}`] = Boolean(body.alerts[key]);
      }
    }
  }
  return out;
}

function sendError(res, err) {
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ ok: false, message: "That number is already on the list." });
  }
  return res
    .status(err.status || 500)
    .json({ ok: false, message: err.message || "Something went wrong." });
}

// List
router.get("/", async (_req, res) => {
  try {
    const data = await AdminAlertContact.find().sort({ createdAt: 1 }).lean();
    res.json({ ok: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// Add
router.post("/", async (req, res) => {
  try {
    const count = await AdminAlertContact.countDocuments();
    if (count >= 10) {
      return res
        .status(400)
        .json({ ok: false, message: "You can have up to 10 phones." });
    }
    const fields = cleanBody(req.body);
    const doc = new AdminAlertContact({
      addedBy: req.admin?.email || "",
    });
    doc.set(fields);
    await doc.save();
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    sendError(res, err);
  }
});

// Edit (any subset of fields)
router.patch("/:id", async (req, res) => {
  try {
    const doc = await AdminAlertContact.findByIdAndUpdate(
      req.params.id,
      { $set: cleanBody(req.body, { partial: true }) },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ ok: false, message: "Not found." });
    res.json({ ok: true, data: doc });
  } catch (err) {
    sendError(res, err);
  }
});

// Remove
router.delete("/:id", async (req, res) => {
  try {
    const doc = await AdminAlertContact.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

// Send a test text
router.post("/:id/test", async (req, res) => {
  try {
    const doc = await AdminAlertContact.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: "Not found." });
    await sendSms(
      doc.phone,
      "Skyrio: test alert. You'll get texts like this when a ticket needs you."
    );
    doc.lastTestAt = new Date();
    await doc.save();
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
