import express, { Router } from "express";
import Stripe from "stripe";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
      const bookingId = intent.metadata?.bookingId;
      const userId = intent.metadata?.userId;

      try {
        // Idempotency guard — Stripe can (and does) retry webhook
        // deliveries. Without this check, a retried event would
        // re-award XP and re-fire notifications for a booking
        // that's already confirmed.
        if (bookingId) {
          const existing = await Booking.findById(bookingId).select("status");
          if (existing?.status === "confirmed") {
            return res.json({ received: true, alreadyProcessed: true });
          }
        }

        // 1. Confirm booking + store BOTH payment ID fields
        //    so Atlas can find it for refunds later
        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            $set: {
              status: "confirmed",
              paidAt: new Date(),
              paymentIntentId: intent.id,
              stripePaymentIntentId: intent.id,
              totalAmount: intent.amount / 100,
              totalCurrency: intent.currency?.toUpperCase() || "USD",
            },
          });
        }

        // 2. Award XP + fire both notifications
        if (userId) {
          await User.findByIdAndUpdate(userId, { $inc: { xp: 200 } });

          await Notification.create({
            user: userId,
            type: "booking",
            title: "Booking Confirmed ✈️",
            message: "Your booking has been confirmed. Have a great trip!",
            link: "/saved-trips",
          });

          await Notification.create({
            user: userId,
            type: "xp",
            title: "🌟 +200 XP Earned!",
            message:
              "You earned 200 XP for booking a trip. Check your Passport to see your progress!",
            link: "/passport",
          });
        }
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    }

    // ── Refund completed (fired by Atlas request_refund) ───────
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
          const refundAmount = charge.amount_refunded / 100;
          const isFullRefund = charge.refunded === true;

          await Booking.findByIdAndUpdate(booking._id, {
            $set: {
              refundStatus: "succeeded",
              refundAmount: refundAmount,
              refundedAt: new Date(),
            },
          });

          if (booking.user) {
            await Notification.create({
              user: booking.user,
              type: "booking",
              title: "Refund Processed 💰",
              message: `Your ${
                isFullRefund ? "full" : "partial"
              } refund of $${refundAmount.toFixed(
                2
              )} has been processed. It may take 5-10 business days to appear on your statement.`,
              link: "/saved-trips",
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

        if (booking) {
          await Booking.findByIdAndUpdate(booking._id, {
            $set: { refundStatus: "failed" },
          });

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

    // ── Payment failed ─────────────────────────────────────────
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
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
// Now requires auth, verifies the booking actually belongs to the
// requester, and derives the charge amount from the booking record
// itself rather than trusting whatever the client sends. Trusting a
// client-supplied `amount` here would let anyone pay whatever they
// want for a booking, regardless of its real price.

router.post("/create-payment-intent", requireAuth, async (req, res) => {
  try {
    const { bookingId, currency = "usd" } = req.body;
    const userId = req.user?.id ?? req.user?._id;

    if (!bookingId) {
      return res
        .status(400)
        .json({ ok: false, message: "bookingId is required" });
    }

    // Ownership check — this booking must belong to the authenticated
    // user, not whoever the client claims it belongs to.
    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ ok: false, message: "Booking not found" });
    }

    // Confirmed from the Booking schema: the stored price lives in
    // `total`. Never trust a client-supplied amount — a client could
    // pay whatever they want for a booking otherwise.
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

    // Pre-link the PaymentIntent to the booking so Atlas can
    // find it even before the webhook confirms payment
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

export default router;
