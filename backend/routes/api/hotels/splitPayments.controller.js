// ─────────────────────────────────────────────────────────────
// Generic "each traveler pays their own share" system. Built against
// the hotel flow first (bookingType: "hotel"), but bookingPayload is
// deliberately opaque/generic so the same session model, expiry/
// refund handling, and webhook completion logic can be reused for
// excursions (and flights, if a similar system doesn't already exist
// there) without rebuilding any of this.
//
// Flow:
//   1. createSplitPayment  — prebooks every offer, creates one Stripe
//      PaymentIntent per share, saves the session with an expiry.
//   2. getSplitPaymentStatus — polled by both the organizer's
//      "waiting on everyone" screen and each traveler's own pay page.
//   3. getShareClientSecret — the ONE endpoint that returns a client
//      secret, and only for the specific share requested (never
//      leaks other travelers' payment secrets via the status endpoint).
//   4. handleStripeWebhookEvent — call this from your existing Stripe
//      webhook route (see wiring note at the bottom of this file) on
//      every `payment_intent.succeeded` / `payment_intent.payment_failed`
//      event. Marks the matching share, and once every share on a
//      split is paid, calls finalizeHotelBookings() to actually book
//      with LiteAPI — exactly once, no matter how many shares there are.
//   5. expireIfNeeded — lazy expiry check (no cron needed): if a split
//      is still "collecting" past its expiresAt, cancels it and
//      refunds any shares that DID pay. Called at the top of
//      getSplitPaymentStatus so it self-heals on the next poll.
// ─────────────────────────────────────────────────────────────

import Stripe from "stripe";
import SplitPayment from "../models/SplitPayment.js";
import { liteapi } from "./hotel.provider.js";
import { finalizeHotelBookings } from "./hotels.controller.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Conservative placeholder for how long a LiteAPI prebook price/
// availability hold is good for. VERIFY this against your actual
// LiteAPI account/plan — if their real TTL is longer or shorter,
// update this constant. Setting it too long risks trying to book an
// expired/repriced rate; too short risks cancelling+refunding a split
// that was about to finish paying.
const PREBOOK_EXPIRY_MINUTES = 25;

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1)
    return { firstName: parts[0] || "Guest", lastName: "Traveler" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/split-payments
//
// Body (bookingType: "hotel"):
//   {
//     offers: [
//       { offerId, hotelName, assignedName, assignedEmail },
//       ...
//     ]
//   }
//
// One share per offer — an offer is the smallest unit LiteAPI will
// actually book, so even a bundled multi-room offer (from a multi-
// occupancy search) is ONE share assigned to ONE payer. If different
// people want to pay for different rooms, add those rooms as
// SEPARATE cart entries (separate offers) each assigned to their own
// payer, rather than trying to split one bundled offer's cost across
// multiple people.
//
// Simplification: for a bundled multi-room offer, the assigned payer
// is used as the guest for every room inside it (LiteAPI still needs
// one guest object per occupancy). Collecting a distinct guest name
// per internal room in split mode is a reasonable follow-up, not
// built here yet.
// ─────────────────────────────────────────────────────────────
export async function createSplitPayment(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { bookingType, offers } = req.body;

    if (bookingType !== "hotel") {
      return res.status(400).json({
        ok: false,
        message: "Only bookingType 'hotel' is wired up right now",
      });
    }
    if (!Array.isArray(offers) || offers.length < 2) {
      return res.status(400).json({
        ok: false,
        message:
          "'offers' must have at least 2 entries — a split needs more than one payer",
      });
    }
    for (const o of offers) {
      if (!o.offerId || !o.assignedName || !o.assignedEmail) {
        return res.status(400).json({
          ok: false,
          message:
            "Each offer needs 'offerId', 'assignedName', and 'assignedEmail'",
        });
      }
    }

    // ── Prebook every offer to lock price + get a real total ──
    const prebooks = [];
    for (const offer of offers) {
      const prebookResult = await liteapi.bookRequest("/rates/prebook", {
        method: "POST",
        body: { usePaymentSdk: false, offerId: offer.offerId },
      });
      const prebookId =
        prebookResult?.data?.prebookId ?? prebookResult?.prebookId;
      const totalPrice =
        prebookResult?.data?.totalPrice ?? prebookResult?.totalPrice;
      const currency = prebookResult?.data?.currency ?? "USD";

      if (!prebookId || !Number.isFinite(totalPrice)) {
        return res.status(502).json({
          ok: false,
          message:
            "LiteAPI didn't return a valid prebook for one of the shares — please try again.",
        });
      }
      prebooks.push({ ...offer, prebookId, totalPrice, currency });
    }

    const currency = prebooks[0].currency;
    if (prebooks.some((p) => p.currency !== currency)) {
      return res.status(422).json({
        ok: false,
        message:
          "Shares have different currencies — split them into separate sessions.",
      });
    }

    // ── One Stripe PaymentIntent PER SHARE (this is the whole point —
    // each traveler confirms their own, separately, whenever they open
    // their own pay link) ──
    const shares = [];
    for (const p of prebooks) {
      const amountInCents = Math.round(p.totalPrice * 100);
      const { firstName, lastName } = splitName(p.assignedName);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        receipt_email: p.assignedEmail,
        metadata: {
          type: "split_payment_share",
          hotelName: p.hotelName || "",
        },
      });

      shares.push({
        label: p.hotelName || "Room",
        assignedName: p.assignedName,
        assignedEmail: p.assignedEmail,
        amount: p.totalPrice,
        paymentIntentId: paymentIntent.id,
        status: "pending",
        // stashed only in memory here, not on the share subdoc —
        // used below to build bookingPayload.bookings
        _prebookId: p.prebookId,
        _firstName: firstName,
        _lastName: lastName,
      });
    }

    const totalAmount = shares.reduce((sum, s) => sum + s.amount, 0);
    const expiresAt = new Date(Date.now() + PREBOOK_EXPIRY_MINUTES * 60 * 1000);

    const bookingPayload = {
      bookings: shares.map((s) => ({
        prebookId: s._prebookId,
        holder: {
          firstName: s._firstName,
          lastName: s._lastName,
          email: s.assignedEmail,
        },
        guests: [
          {
            occupancyNumber: 1,
            firstName: s._firstName,
            lastName: s._lastName,
            email: s.assignedEmail,
          },
        ],
      })),
    };

    const splitPayment = await SplitPayment.create({
      bookingType: "hotel",
      organizerId: userId,
      currency,
      totalAmount,
      // strip the internal-only fields before saving
      shares: shares.map(({ _prebookId, _firstName, _lastName, ...s }) => s),
      expiresAt,
      bookingPayload,
      status: "collecting",
    });

    return res.json({
      ok: true,
      splitPaymentId: splitPayment._id,
      totalAmount,
      currency,
      expiresAt,
      shares: splitPayment.shares.map((s) => ({
        shareId: s._id,
        label: s.label,
        assignedName: s.assignedName,
        amount: s.amount,
        status: s.status,
      })),
    });
  } catch (err) {
    console.error("Split payment creation error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to create split payment",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Lazy expiry + refund — called at the top of getSplitPaymentStatus
// so an expired split self-heals on its next poll instead of needing
// a cron job. Refunds anyone who already paid, since the deal falls
// through if not everyone pays before the price/availability hold
// expires.
// ─────────────────────────────────────────────────────────────
async function expireIfNeeded(splitPayment) {
  if (splitPayment.status !== "collecting") return splitPayment;
  if (Date.now() < splitPayment.expiresAt.getTime()) return splitPayment;

  for (const share of splitPayment.shares) {
    if (share.status === "paid") {
      try {
        await stripe.refunds.create({ payment_intent: share.paymentIntentId });
        share.status = "refunded";
        share.refundedAt = new Date();
      } catch (err) {
        // Don't let one failed refund block marking the split
        // cancelled — log loudly so this can be handled manually;
        // this is real money that needs a human to check.
        console.error(
          `URGENT: failed to auto-refund share ${share._id} (paymentIntent ${share.paymentIntentId}) on expired split ${splitPayment._id}:`,
          err
        );
      }
    }
  }
  splitPayment.status = "cancelled";
  await splitPayment.save();
  return splitPayment;
}

// ─────────────────────────────────────────────────────────────
// GET /api/split-payments/:id
// Status for both the organizer's live-tracking screen and each
// traveler's own pay page. Deliberately excludes clientSecret/
// paymentIntentId — those come ONLY from getShareClientSecret, and
// only for the specific share being paid.
// ─────────────────────────────────────────────────────────────
export async function getSplitPaymentStatus(req, res) {
  try {
    const splitPayment = await SplitPayment.findById(req.params.id);
    if (!splitPayment) {
      return res
        .status(404)
        .json({ ok: false, message: "Split payment not found" });
    }

    await expireIfNeeded(splitPayment);

    return res.json({
      ok: true,
      splitPaymentId: splitPayment._id,
      bookingType: splitPayment.bookingType,
      status: splitPayment.status,
      currency: splitPayment.currency,
      totalAmount: splitPayment.totalAmount,
      expiresAt: splitPayment.expiresAt,
      shares: splitPayment.shares.map((s) => ({
        shareId: s._id,
        label: s.label,
        assignedName: s.assignedName,
        amount: s.amount,
        status: s.status,
      })),
      finalizeError: splitPayment.finalizeError,
    });
  } catch (err) {
    console.error("Split payment status error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to load split payment",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/split-payments/:id/shares/:shareId/client-secret
// The one place a Stripe client secret is ever returned — scoped to
// exactly one share, so opening this link never exposes anyone
// else's payment details.
// ─────────────────────────────────────────────────────────────
export async function getShareClientSecret(req, res) {
  try {
    const splitPayment = await SplitPayment.findById(req.params.id);
    if (!splitPayment) {
      return res
        .status(404)
        .json({ ok: false, message: "Split payment not found" });
    }
    await expireIfNeeded(splitPayment);

    if (splitPayment.status !== "collecting") {
      return res.status(409).json({
        ok: false,
        message: `This split payment is no longer active (status: ${splitPayment.status}).`,
      });
    }

    const share = splitPayment.shares.id(req.params.shareId);
    if (!share) {
      return res.status(404).json({ ok: false, message: "Share not found" });
    }
    if (share.status === "paid") {
      return res
        .status(409)
        .json({ ok: false, message: "This share has already been paid." });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      share.paymentIntentId
    );
    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: share.amount,
      currency: splitPayment.currency,
      label: share.label,
      assignedName: share.assignedName,
    });
  } catch (err) {
    console.error("Split payment client-secret error:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Failed to load payment details",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Call this from your Stripe webhook route on every event — see the
// wiring note below. Not itself an Express route handler; it's meant
// to be invoked with an already-verified Stripe event object.
// ─────────────────────────────────────────────────────────────
export async function handleStripeWebhookEvent(event) {
  if (
    event.type !== "payment_intent.succeeded" &&
    event.type !== "payment_intent.payment_failed"
  ) {
    return; // not a split-payment-relevant event
  }

  const paymentIntent = event.data.object;
  if (paymentIntent.metadata?.type !== "split_payment_share") {
    return; // this PaymentIntent belongs to a different flow (single-payer checkout, etc.)
  }

  const splitPayment = await SplitPayment.findOne({
    "shares.paymentIntentId": paymentIntent.id,
  });
  if (!splitPayment) {
    console.error(
      `Received split-payment webhook for unknown paymentIntent ${paymentIntent.id}`
    );
    return;
  }

  // Ignore late events for a split that already resolved (paid after
  // expiry-refund, or a duplicate webhook delivery — Stripe retries).
  if (splitPayment.status !== "collecting") return;

  const share = splitPayment.shares.find(
    (s) => s.paymentIntentId === paymentIntent.id
  );
  if (!share) return;

  if (event.type === "payment_intent.succeeded") {
    share.status = "paid";
    share.paidAt = new Date();
  } else {
    share.status = "failed";
  }
  await splitPayment.save();

  if (event.type === "payment_intent.succeeded" && splitPayment.isFullyPaid()) {
    // Every traveler has paid — now, and only now, actually book with
    // LiteAPI. This runs exactly once per split payment.
    try {
      const { results, failures } = await finalizeHotelBookings(
        splitPayment.bookingPayload.bookings
      );
      if (failures.length > 0) {
        splitPayment.status = "booking_failed";
        splitPayment.finalizeError = `${failures.length} of ${
          results.length + failures.length
        } rooms failed to book after full payment — needs manual follow-up.`;
        splitPayment.finalBookingResult = { results, failures };
      } else {
        splitPayment.status = "completed";
        splitPayment.finalizedAt = new Date();
        splitPayment.finalBookingResult = { results };
      }
    } catch (err) {
      console.error(
        `URGENT: finalizeHotelBookings threw for fully-paid split ${splitPayment._id}:`,
        err
      );
      splitPayment.status = "booking_failed";
      splitPayment.finalizeError =
        err?.message || "Unknown error finalizing booking";
    }
    await splitPayment.save();
  }
}

// ─────────────────────────────────────────────────────────────
// WIRING NOTE — Stripe webhook
//
// This file does NOT register its own webhook route, because you
// likely already have one Stripe webhook endpoint configured in your
// Stripe dashboard (one webhook URL, one signing secret). Registering
// a second one here would mean managing two separate endpoints for
// the same Stripe account.
//
// Instead, add this to wherever your existing webhook route verifies
// and switches on `event.type`:
//
//   import { handleStripeWebhookEvent } from "./splitPayments.controller.js";
//   ...
//   // inside your existing webhook handler, after signature verification:
//   await handleStripeWebhookEvent(event);
//
// It's a no-op for any event that isn't a split-payment share, so it's
// safe to call unconditionally alongside your other event handling.
//
// If you don't have a Stripe webhook route yet, you'll need one:
//   POST /api/webhooks/stripe
//   — verify via stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET)
//   — this route needs the RAW request body (not JSON-parsed) for
//     signature verification, which usually means excluding it from
//     your global express.json() middleware.
// ─────────────────────────────────────────────────────────────
