// Payment runs through LiteAPI's payment SDK (usePaymentSdk: true) — no Nuitee approval needed.
// Env: LITEAPI_ENV ("sandbox" | "production") picks LITEAPI_SANDBOX_KEY or
//      LITEAPI_PRODUCTION_KEY, same as every other LiteAPI file. LITEAPI_KEY is
//      only a fallback. LITEAPI_FLIGHTS_BASE = same base URL the verify call uses.

import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/requireAuth.js";
import FlightCheckoutSession from "../models/FlightCheckoutSession.js";

const router = Router();
router.use(requireAuth);

const BASE =
  process.env.LITEAPI_FLIGHTS_BASE || "https://api.liteapi.travel/v3.0";

// Same key choice as every other LiteAPI file: LITEAPI_ENV decides.
function liteApiKey() {
  const env = String(process.env.LITEAPI_ENV || "sandbox").toLowerCase();
  return (
    (env === "production"
      ? process.env.LITEAPI_PRODUCTION_KEY
      : process.env.LITEAPI_SANDBOX_KEY) || process.env.LITEAPI_KEY
  );
}

async function liteFlights(method, path, body) {
  const key = liteApiKey();
  if (!key) throw new Error("No LiteAPI key set for this environment");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(
      json?.error?.message ||
        json?.message ||
        `LiteAPI ${path} failed (${res.status})`
    );
    err.status = res.status;
    err.code = json?.error?.code;
    err.lite = json;
    throw err;
  }
  return Array.isArray(json.data) ? json.data[0] : json.data ?? json;
}

// Confirm these paths against real prebook + attach responses in the Playground.
const pickPayment = (d = {}) => ({
  transactionId: d.transactionId ?? d.payment?.transactionId,
  secretKey: d.secretKey ?? d.payment?.secretKey,
  total:
    Number(d.price?.total ?? d.totalPrice ?? d.price?.amount ?? d.price) ||
    undefined,
  currency: d.price?.currency ?? d.currency,
});

async function loadOwnedSession(req, res) {
  if (!mongoose.isValidObjectId(req.params.sessionId)) {
    res.status(400).json({ error: "Invalid checkout reference" });
    return null;
  }
  const session = await FlightCheckoutSession.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Checkout session not found" });
    return null;
  }
  if (String(session.user) !== String(req.user._id)) {
    res
      .status(403)
      .json({ error: "This checkout belongs to a different account" });
    return null;
  }
  return session;
}

const EXPIRED_MSG = "This fare expired. Search again to see current prices.";
const isExpired = (err) => err.status === 404 || err.code === 42005;

// ── 1) PREBOOK ── body: { offerId, contact, passengers }
router.post("/prebook", async (req, res) => {
  try {
    const { offerId, contact, passengers } = req.body || {};
    if (!offerId || !contact || !passengers?.length) {
      return res
        .status(400)
        .json({ error: "offerId, contact and passengers are required" });
    }

    const prebook = await liteFlights("POST", "/flights/prebooks", {
      offerId,
      usePaymentSdk: true,
      contact,
      passengers,
    });
    const pay = pickPayment(prebook);
    if (!prebook?.prebookId || !pay.transactionId || !pay.secretKey) {
      return res
        .status(502)
        .json({ error: "Prebook response missing payment fields", prebook });
    }

    const session = await FlightCheckoutSession.create({
      user: req.user._id,
      offerId,
      prebookId: prebook.prebookId,
      transactionId: pay.transactionId,
      total: pay.total,
      currency: pay.currency || "USD",
      contact,
      passengers,
      raw: { prebook },
    });

    res.json({
      sessionId: session._id,
      secretKey: pay.secretKey,
      total: session.total,
      currency: session.currency,
      servicesAttachable: prebook.servicesAttachable ?? null,
    });
  } catch (err) {
    console.error("[flight-payments/prebook]", err.message, err.lite || "");
    res
      .status(isExpired(err) ? 410 : 500)
      .json({ error: isExpired(err) ? EXPIRED_MSG : err.message });
  }
});

// ── 2) ATTACH SEATS/BAGS (before payment) ── body: { selectedServices: [{ passengerIndex, serviceId, quantity }] }
router.post("/:sessionId/services", async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return;
    if (session.status !== "PREBOOKED") {
      return res
        .status(409)
        .json({ error: "Seats can't be changed after payment" });
    }

    const { selectedServices } = req.body || {};
    if (!Array.isArray(selectedServices) || !selectedServices.length) {
      return res.status(400).json({ error: "selectedServices is required" });
    }

    const result = await liteFlights(
      "POST",
      `/flights/prebooks/${session.prebookId}/services`,
      {
        selectedServices,
      }
    );
    const pay = pickPayment(result);
    if (!pay.transactionId || !pay.secretKey) {
      return res
        .status(502)
        .json({ error: "Attach response missing payment fields", result });
    }

    session.transactionId = pay.transactionId; // new one supersedes the old one
    if (pay.total) session.total = pay.total;
    if (pay.currency) session.currency = pay.currency;
    session.selectedServices = selectedServices;
    await session.save();

    res.json({
      secretKey: pay.secretKey,
      total: session.total,
      currency: session.currency,
    });
  } catch (err) {
    console.error("[flight-payments/services]", err.message, err.lite || "");
    res
      .status(isExpired(err) ? 410 : 500)
      .json({ error: isExpired(err) ? EXPIRED_MSG : err.message });
  }
});

// ── 3) BOOK (called from the return page after payment) ──
router.post("/:sessionId/book", async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return;

    if (session.status === "BOOKED") {
      return res.json({
        bookingId: session.bookingId,
        bookingRef: session.bookingRef,
        duplicate: true,
      });
    }
    if (session.status === "BOOKING")
      return res.status(202).json({ status: "BOOKING" });

    session.status = "BOOKING";
    await session.save();

    try {
      const booking = await liteFlights("POST", "/flights/bookings", {
        prebookId: session.prebookId,
        payment: {
          method: "TRANSACTION_ID",
          transactionId: session.transactionId,
        },
      });
      session.status = "BOOKED";
      session.bookingId = booking?.bookingId;
      session.bookingRef = booking?.bookingRef;
      session.raw = { ...(session.raw || {}), booking };
      await session.save();
      res.json({
        bookingId: session.bookingId,
        bookingRef: session.bookingRef,
      });
    } catch (err) {
      if (err.status === 409)
        return res.status(202).json({ status: "BOOKING" });
      session.status = "FAILED";
      session.error = err.message;
      await session.save().catch(() => {});
      console.error(
        "[flight-payments/book]",
        session._id,
        err.message,
        err.lite || ""
      );
      res.status(502).json({
        error:
          "The airline couldn't confirm this booking. The hold on your card will be released automatically.",
      });
    }
  } catch (err) {
    console.error("[flight-payments/book] unexpected", err.message);
    res.status(500).json({
      error:
        "Something went wrong confirming your booking. Check My Trips shortly.",
    });
  }
});

// ── Status (polling from the return page) ──
router.get("/:sessionId", async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return;
    res.json({
      status: session.status,
      bookingId: session.bookingId,
      bookingRef: session.bookingRef,
      total: session.total,
      currency: session.currency,
      error: session.error,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
