import express, { Router } from "express";
import Stripe from "stripe";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import SplitPayment from "../models/SplitPayment.js";
import {
  SHARE_KIND,
  setSyncIo,
  markShareAuthorized,
  markShareFailed,
} from "../services/sharedRooms.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendRefundIssuedEmail, formatMoney } from "../services/bookingEmails.js";
import { awardXpForBooking, reverseBookingXp } from "../services/xpService.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── POST /api/stripe/webhook ─────────────────────────────────

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ── Payment succeeded ──────────────────────────────────────
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;

      // Shared-room shares (Sync Together) are charged by
      // services/sharedRooms.js when the room is booked — that code writes
      // each person's My Trips record. Never run the solo branch for them.
      if (intent.metadata?.kind === SHARE_KIND) {
        return res.json({ received: true });
      }
      // Legacy "organizer pays, everyone reimburses" shares — retired.
      if (intent.metadata?.kind === "split_share") {
        console.warn("[webhook] legacy split_share succeeded — no action", intent.id);
        return res.json({ received: true });
      }

      // ── Solo booking ──────────────────────────────────────────
      // Also covers hotel checkouts (metadata.kind "hotel_checkout"):
      // hotels.controller.js writes bookingId onto the PaymentIntent and
      // flips the booking pending → confirmed itself. Whichever runs first
      // (that code or this webhook) confirms it; the other sees
      // "confirmed" and skips, so XP and notifications happen once.
      const bookingId = intent.metadata?.bookingId;
      const userId = intent.metadata?.userId;

      try {
        // Idempotency guard — Stripe retries webhook deliveries, and
        // hotels.controller.js may have confirmed the booking first.
        let alreadyConfirmed = false;
        if (bookingId) {
          const existing = await Booking.findById(bookingId).select("status");
          alreadyConfirmed = existing?.status === "confirmed";
        }

        // 1. Confirm booking + store BOTH payment ID fields so Atlas can
        //    find it for refunds later. amount_received = what was ACTUALLY
        //    charged (hotel checkouts may capture less than was authorized
        //    when only some rooms could be booked).
        if (bookingId && !alreadyConfirmed) {
          const charged = (intent.amount_received || intent.amount) / 100;
          await Booking.findByIdAndUpdate(bookingId, {
            $set: {
              status: "confirmed",
              paidAt: new Date(),
              paymentIntentId: intent.id,
              stripePaymentIntentId: intent.id,
              total: charged,
              totalAmount: charged,
              totalCurrency: intent.currency?.toUpperCase() || "USD",
            },
          });
        }

        // 2. Booking confirmed notification — once, by whoever confirmed it.
        if (userId && !alreadyConfirmed) {
          await Notification.create({
            user: userId,
            type: "booking",
            title: "Booking Confirmed ✈️",
            message: "Your booking has been confirmed. Have a great trip!",
            link: "/saved-trips",
          });
        }

        // 3. Booking XP — through the XP ledger (pending until the trip
        //    starts, plan multiplier applied, reversed if cancelled). Runs
        //    even when the booking was already confirmed elsewhere: the
        //    ledger pays each booking exactly once, so retries are safe.
        if (bookingId) {
          try {
            await awardXpForBooking(bookingId);
          } catch (xpErr) {
            // XP must never break a booking confirmation.
            console.error("[webhook] booking XP failed:", bookingId, xpErr);
          }
        }

        if (alreadyConfirmed) {
          return res.json({ received: true, alreadyProcessed: true });
        }
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    }

    // ── Refund completed ───────────────────────────────────────
    // Fired for refunds issued by the cancel flow (hotels), Atlas
    // request_refund, or manually in the Stripe dashboard.
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent;

      try {
        const booking = await Booking.findOne({
          $or: [
            { stripePaymentIntentId: paymentIntentId },
            { paymentIntentId: paymentIntentId },
          ],
        });

        if (booking) {
          // amount_refunded is the running TOTAL refunded on this charge.
          const refundAmount = charge.amount_refunded / 100;
          const isFullRefund = charge.refunded === true;
          const currency =
            booking.totalCurrency || String(charge.currency || "usd").toUpperCase();

          // Idempotency — Stripe retries webhooks. Only notify/email when
          // this refund total is new.
          const alreadyRecorded =
            booking.refundStatus === "succeeded" &&
            Number(booking.refundAmount) === refundAmount &&
            booking.refundedAt;

          await Booking.findByIdAndUpdate(booking._id, {
            $set: {
              refundStatus: "succeeded",
              refundAmount: refundAmount,
              refundedAt: booking.refundedAt || new Date(),
            },
          });

          // Fully refunded → no trip, no XP. Safe to repeat (already-reversed
          // rows are skipped). Partial refunds keep their XP.
          if (isFullRefund) {
            await reverseBookingXp(booking._id, "booking fully refunded").catch(
              (e) => console.error("[webhook] reverse booking XP failed:", e)
            );
          }

          if (!alreadyRecorded) {
            if (booking.user) {
              await Notification.create({
                user: booking.user,
                type: "booking",
                title: "Refund Processed 💰",
                message: `Your ${
                  isFullRefund ? "full" : "partial"
                } refund of ${formatMoney(
                  refundAmount,
                  currency
                )} has been processed. It may take 5-10 business days to appear on your statement.`,
                link: "/saved-trips",
              });
            }

            // Refund email — Stripe has confirmed the money went out.
            let to = booking.email;
            if (!to && booking.user) {
              const u = await User.findById(booking.user).select("email").lean();
              to = u?.email;
            }
            sendRefundIssuedEmail({
              to,
              name: (booking.name || "").split(" ")[0],
              tripDetails: booking.tripDetails,
              amount: refundAmount,
              currency,
              bookingId: String(booking._id),
            });
          }
        }
      } catch (err) {
        console.error("Refund webhook processing error:", err);
      }
    }

    // ── Refund failed ──────────────────────────────────────────
    if (event.type === "refund.failed") {
      const refund = event.data.object;
      const paymentIntentId = refund.payment_intent;

      try {
        const booking = await Booking.findOne({
          $or: [
            { stripePaymentIntentId: paymentIntentId },
            { paymentIntentId: paymentIntentId },
          ],
        });

        if (booking && booking.refundStatus !== "failed") {
          await Booking.findByIdAndUpdate(booking._id, {
            $set: { refundStatus: "failed" },
          });
          // Shows up in /admin/bookings as "Refund: … failed".
          console.error(
            "[webhook] REFUND FAILED — handle manually",
            String(booking._id),
            paymentIntentId
          );

          if (booking.user) {
            await Notification.create({
              user: booking.user,
              type: "booking",
              title: "Refund Issue ⚠️",
              message:
                "Your refund could not be processed. Our support team has been notified and will follow up.",
              link: "/saved-trips",
            });
          }
        }
      } catch (err) {
        console.error("Refund failure webhook error:", err);
      }
    }

    // ── Card held (authorize-only) ─────────────────────────────
    // Shared-room shares: the hold is in. When the last one lands, the
    // room is booked and every hold is charged.
    if (event.type === "payment_intent.amount_capturable_updated") {
      const intent = event.data.object;
      if (intent.metadata?.kind === SHARE_KIND && intent.status === "requires_capture") {
        setSyncIo(req.app.get("io"));
        await markShareAuthorized({
          splitId: intent.metadata.splitPaymentId,
          shareId: intent.metadata.shareId,
          paymentIntentId: intent.id,
        }).catch((err) => console.error("[webhook] shared share hold error:", err));
      }
      return res.json({ received: true });
    }

    // ── Hold released / expired ────────────────────────────────
    // A held card that Stripe let go (e.g. it expired) can't be charged,
    // so that share goes back to "not held yet".
    if (event.type === "payment_intent.canceled") {
      const intent = event.data.object;
      if (intent.metadata?.kind === SHARE_KIND) {
        await SplitPayment.updateOne(
          {
            _id: intent.metadata.splitPaymentId,
            status: "collecting",
            shares: {
              $elemMatch: {
                _id: intent.metadata.shareId,
                stripePaymentIntentId: intent.id,
                status: "authorized",
              },
            },
          },
          {
            $set: {
              "shares.$.status": "unpaid",
              "shares.$.lastError": "Your card hold was released. Please hold your share again.",
            },
          }
        ).catch((err) => console.error("[webhook] shared share cancel error:", err));
      }
      return res.json({ received: true });
    }

    // ── Payment failed ─────────────────────────────────────────
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;

      // Shared-room share: the card was declined. Only that person's share
      // is marked; they can try another card before the deadline.
      if (intent.metadata?.kind === SHARE_KIND) {
        const { splitPaymentId, shareId } = intent.metadata;
        await markShareFailed({
          splitId: splitPaymentId,
          shareId,
          message: intent.last_payment_error?.message,
        }).catch((err) => console.error("[webhook] shared share failure error:", err));
        return res.json({ received: true });
      }
      if (intent.metadata?.kind === "split_share") {
        return res.json({ received: true });
      }

      const bookingId = intent.metadata?.bookingId;
      const userId = intent.metadata?.userId;

      try {
        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            $set: { status: "pending" },
          });
        }

        if (userId) {
          await Notification.create({
            user: userId,
            type: "booking",
            title: "Payment Failed ❌",
            message:
              "Your payment could not be processed. Please try again or use a different payment method.",
            link: "/saved-trips",
          });
        }
      } catch (err) {
        console.error("Payment failed webhook error:", err);
      }
    }

    res.json({ received: true });
  }
);

// ─── POST /api/stripe/create-payment-intent ───────────────────
// Requires auth, verifies the booking belongs to the requester, and
// derives the charge amount from the booking record itself rather than
// trusting whatever the client sends.

router.post("/create-payment-intent", requireAuth, async (req, res) => {
  try {
    const { bookingId, currency = "usd" } = req.body;
    const userId = req.user?.id ?? req.user?._id;

    if (!bookingId) {
      return res
        .status(400)
        .json({ ok: false, message: "bookingId is required" });
    }

    // Ownership check — this booking must belong to the authenticated user.
    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ ok: false, message: "Booking not found" });
    }

    // The stored price lives in `total`. Never trust a client-supplied amount.
    const amount = booking.total;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        message: "This booking has no valid price on file",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: {
        bookingId: String(bookingId),
        userId: String(userId),
      },
    });

    // Pre-link the PaymentIntent to the booking so Atlas can find it even
    // before the webhook confirms payment.
    await Booking.findByIdAndUpdate(bookingId, {
      $set: {
        stripePaymentIntentId: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("PaymentIntent error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create payment intent" });
  }
});

// ─── Retired: group reimbursement split ───────────────────────
// Sync Together no longer has one person pay for everyone. Each traveler
// books and pays for their own part; shared rooms use per-person holds
// (see routes/api/syncTogether.routes.js → /:id/shared-rooms).
const retired = (_req, res) =>
  res.status(410).json({
    ok: false,
    message: "Group payments changed: everyone now books their own part from the trip page.",
  });
router.post("/create-group-payment-intents", requireAuth, retired);
router.get("/split-status/:bookingId", requireAuth, retired);
router.get("/my-split/:bookingId", requireAuth, retired);

export default router;
