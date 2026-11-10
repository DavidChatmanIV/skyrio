import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Skyrio API",
    ts: new Date().toISOString(),
  });
});

router.get("/status", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const db = states[mongoose.connection.readyState] || "unknown";
  res.json({ ok: db === "connected", db, ts: new Date().toISOString() });
});

export default router;
