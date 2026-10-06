// backend/routes/hotelPayments.routes.js
// Mounted in routes/api/index.js:  await mount("/hotel-payments", "../hotelPayments.routes.js");
// => POST /api/hotel-payments/intent, POST /api/hotel-payments/confirm
//
// Flow: LiteAPI prebook -> Stripe PI (manual capture = authorize only)
//       -> LiteAPI book (ACC_CREDIT_CARD) -> capture on success / cancel on failure
// Env:  STRIPE_SECRET_KEY, LITEAPI_ENV, LITEAPI_SANDBOX_KEY, LITEAPI_PRODUCTION_KEY,
//       SKYRIO_MARKUP_PCT (optional, e.g. 8)

import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/requireAuth.js";
import HotelCheckoutSession from "../models/HotelCheckoutSession.js";

const router = Router();
router.use(requireAuth);

// Lazy init so a missing env var gives a clear 500 instead of crashing on import
let _stripe;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not set");
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const LITE_BOOK = "https://book.liteapi.travel/v3.0";
const MARKUP = Number(process.env.SKYRIO_MARKUP_PCT || 0) / 100;
const ZERO_DECIMAL = new Set([
  "jpy",
  "krw",
  "vnd",
  "clp",
  "isk",
  "ugx",
  "xof",
  "xaf",
]);
const toStripeAmount = (amount, currency) =>
  ZERO_DECIMAL.has(currency) ? Math.round(amount) : Math.round(amount * 100);

// Same key selection as the rest of the backend: LITEAPI_ENV picks the key.
function liteApiKey() {
  const env = String(process.env.LITEAPI_ENV || "sandbox").toLowerCase();
  return (
    (env === "production"
      ? process.env.LITEAPI_PRODUCTION_KEY
      : process.env.LITEAPI_SANDBOX_KEY) || process.env.LITEAPI_KEY
  );
}

async function liteRequest(path, body) {
  const key = liteApiKey();
  if (!key) {
    throw new Error(
      "LiteAPI key is not set (check LITEAPI_ENV / LITEAPI_SANDBOX_KEY)"
    );
  }
  const res = await fetch(`${LITE_BOOK}${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(
      json?.error?.message ||
        json?.message ||
        `LiteAPI ${path} failed (${res.status})`
    );
    err.status = res.status;
    err.lite = json;
    throw err;
  }
  return json.data;
}

// ── STEP 1: prebook + authorize-only PaymentIntent ── body: { offerId }
router.post("/intent", async (req, res) => {
  try {
    const { offerId } = req.body || {};
    if (!offerId) return res.status(400).json({ error: "offerId is required" });

    const prebook = await liteRequest("/rates/prebook", {
      offerId,
      usePaymentSdk: false,
    });

    // Confirm these two field names against a real prebook response in the Playground.
    const netPrice = Number(prebook?.price);
    const currency = String(prebook?.currency || "USD").toLowerCase();
    if (!prebook?.prebookId || !netPrice || Number.isNaN(netPrice)) {
      return res.status(502).json({
        error: "Could not read prebookId/price from LiteAPI",
        prebook,
      });
    }

    const total = Number((netPrice * (1 + MARKUP)).toFixed(2)); // server-side only

    const intent = await stripe().paymentIntents.create(
      {
        amount: toStripeAmount(total, currency),
        currency,
        capture_method: "manual",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
          kind: "hotel_checkout", // lets your existing webhook ignore/route these
          prebookId: prebook.prebookId,
          userId: String(req.user._id),
        },
      },
      { idempotencyKey: `skyrio_hotel_${prebook.prebookId}` }
    );

    await HotelCheckoutSession.findOneAndUpdate(
      { paymentIntentId: intent.id },
      {
        user: req.user._id,
        offerId,
        prebookId: prebook.prebookId,
        paymentIntentId: intent.id,
        total,
        netPrice,
        currency,
        raw: { prebook },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      total,
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    console.error("[hotel-payments/intent]", err.message, err.lite || "");
    const expired = /offer|not found|expired/i.test(err.message);
    res.status(expired ? 410 : 500).json({
      error: expired
        ? "This rate is no longer available. Search again to see current prices."
        : err.message,
    });
  }
});

// ── STEP 2: book, then capture or cancel ── body: { paymentIntentId, holder, guests }
router.post("/confirm", async (req, res) => {
  const { paymentIntentId, holder, guests } = req.body || {};
  if (
    !paymentIntentId ||
    !holder?.firstName ||
    !holder?.lastName ||
    !holder?.email
  ) {
    return res
      .status(400)
      .json({ error: "paymentIntentId and holder name/email are required" });
  }

  const session = await HotelCheckoutSession.findOne({ paymentIntentId }).catch(
    () => null
  );
  if (!session)
    return res.status(404).json({ error: "Checkout session not found" });
  if (String(session.user) !== String(req.user._id)) {
    return res
      .status(403)
      .json({ error: "This payment belongs to a different account" });
  }
  if (session.status === "BOOKED")
    return res.json({ booking: session, duplicate: true });
  if (session.status === "BOOKING")
    return res.status(202).json({ status: "BOOKING" });

  let intent;
  try {
    intent = await stripe().paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  if (intent.status !== "requires_capture") {
    return res
      .status(400)
      .json({ error: `Payment is not authorized (status: ${intent.status})` });
  }

  session.status = "BOOKING";
  session.holder = holder;
  session.guests = guests;
  await session.save();

  let liteBooking;
  try {
    liteBooking = await liteRequest("/rates/book", {
      prebookId: session.prebookId,
      clientReference: paymentIntentId,
      holder,
      guests: guests?.length
        ? guests
        : [
            {
              occupancyNumber: 1,
              firstName: holder.firstName,
              lastName: holder.lastName,
              email: holder.email,
            },
          ],
      payment: { method: "ACC_CREDIT_CARD" },
    });
  } catch (bookErr) {
    await stripe()
      .paymentIntents.cancel(paymentIntentId)
      .catch(() => {});
    session.status = "FAILED";
    session.error = bookErr.message;
    await session.save().catch(() => {});
    console.error(
      "[hotel-payments/confirm] book failed",
      bookErr.message,
      bookErr.lite || ""
    );
    return res.status(409).json({
      error:
        "The hotel couldn't confirm this room, so your card was not charged. Try another rate.",
    });
  }

  // Room exists now — capture. Never cancel past this point.
  try {
    await stripe().paymentIntents.capture(paymentIntentId);
    session.status = "BOOKED";
    session.providerBookingId = liteBooking?.bookingId;
    session.hotelConfirmationCode = liteBooking?.hotelConfirmationCode;
    session.raw = { ...(session.raw || {}), booking: liteBooking };
    await session.save();
    res.json({ booking: session });
  } catch (err) {
    session.status = "NEEDS_RECONCILE";
    session.error = err.message;
    session.providerBookingId = liteBooking?.bookingId;
    await session.save().catch(() => {});
    console.error(
      "[hotel-payments/confirm] RECONCILE",
      paymentIntentId,
      err.message
    );
    res.status(500).json({
      error:
        "Your room is booked and we're finalizing payment. Check My Trips shortly.",
    });
  }
});

export default router;
