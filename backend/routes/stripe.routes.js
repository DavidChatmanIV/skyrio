import express, { Router } from "express";
import Stripe from "stripe";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import SyncGroup from "../models/SyncGroup.js";
import SplitPayment from "../models/SplitPayment.js";
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

      // NEW — group split-payment share. Tagged with kind: "split_share"
      // at creation time (see create-group-payment-intents below) so it
      // never falls into the solo-booking branch below: a group booking's
      // bookingId is shared by every member's PaymentIntent, and running
      // the solo "confirm this booking" logic once per share would be
      // wrong (and would double-award XP/notifications per payer).
      if (intent.metadata?.kind === "split_share") {
        const { splitPaymentId, shareId, groupId } = intent.metadata;
        try {
          const split = await SplitPayment.findById(splitPaymentId);
          if (!split) {
            console.error(
              "[webhook] split_share succeeded but SplitPayment not found:",
              splitPaymentId
            );
            return res.json({ received: true });
          }

          const share = split.shares.id(shareId);
          if (!share) {
            console.error(
              "[webhook] split_share succeeded but share not found:",
              shareId
            );
            return res.json({ received: true });
          }

          // Idempotency — Stripe retries webhook deliveries.
          if (share.status !== "paid") {
            share.status = "paid";
            share.paidAt = new Date();
            share.stripePaymentIntentId = intent.id;
            await split.save();

            // Mirror onto the SyncGroup member for the frontend fields
            // SyncGroupPage.jsx already reads directly off the group.
            if (share.member) {
              await SyncGroup.updateOne(
                { _id: groupId, "members._id": share.member },
                { $set: { "members.$.paymentStatus": "paid" } }
              );
            }
          }

          const populated = await SplitPayment.findById(splitPaymentId);
          const allPaid = populated.allPaid();

          if (allPaid) {
            await Booking.findByIdAndUpdate(populated.booking, {
              $set: { status: "confirmed", paidAt: new Date() },
            });
            await SyncGroup.findByIdAndUpdate(groupId, {
              $set: { status: "booked" },
            });
          }

          // Live update — same room pattern PaymentProgressPanel expects
          // (socket.emit("join-group", groupId) on the client side).
          const io = req.app.get("io");
          if (io) {
            io.to(`group:${groupId}`).emit("payment:update", {
              bookingId: String(populated.booking),
              splitPayments: populated.shares.map((s) => ({
                memberId: s.member ? String(s.member) : null,
                status: s.status,
              })),
              allPaid,
            });
          }
        } catch (err) {
          console.error("[webhook] split_share processing error:", err);
        }
        return res.json({ received: true });
      }

      // ── Solo booking (existing behavior, unchanged) ──────────
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

      // NEW — group split share failed. Mark just that share failed;
      // don't touch the Booking or the rest of the group.
      if (intent.metadata?.kind === "split_share") {
        const { splitPaymentId, shareId } = intent.metadata;
        try {
          const split = await SplitPayment.findById(splitPaymentId);
          const share = split?.shares.id(shareId);
          if (share) {
            share.status = "failed";
            await split.save();
          }
        } catch (err) {
          console.error("[webhook] split_share failure error:", err);
        }
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

// ─── POST /api/stripe/create-group-payment-intents ────────────
// Called once, by BookingCheckout.jsx's StripePayForm, right after the
// owner's own checkout succeeds and the real LiteAPI Booking exists.
// Splits booking.total evenly across the owner + every group member,
// creates one Stripe PaymentIntent per payer, and flips the group into
// "payment_pending".
//
// ASSUMPTION: even split (total / (members.length + 1)), not weighted
// by each member's optional `budget` field. Flag if this should be
// budget-weighted instead.

router.post("/create-group-payment-intents", requireAuth, async (req, res) => {
  try {
    const { bookingId, groupId, currency = "usd" } = req.body;
    const userId = req.user?.id ?? req.user?._id;

    if (!bookingId || !groupId) {
      return res
        .status(400)
        .json({ ok: false, message: "bookingId and groupId are required" });
    }

    const [booking, group] = await Promise.all([
      Booking.findOne({ _id: bookingId, user: userId }),
      SyncGroup.findById(groupId),
    ]);

    if (!booking) {
      return res.status(404).json({ ok: false, message: "Booking not found" });
    }
    if (!group) {
      return res.status(404).json({ ok: false, message: "Group not found" });
    }
    if (String(group.owner) !== String(userId)) {
      return res.status(403).json({
        ok: false,
        message: "Only the trip organizer can start group payment",
      });
    }

    // Idempotency — BookingCheckout.jsx already treats this call as
    // non-fatal/best-effort and could plausibly retry it.
    const existing = await SplitPayment.findOne({ booking: booking._id });
    if (existing) {
      await SyncGroup.findByIdAndUpdate(groupId, {
        $set: { bookingId: booking._id, status: "payment_pending" },
      });
      return res.json({
        ok: true,
        splitPaymentId: existing._id,
        alreadyExists: true,
      });
    }

    const amount = booking.total;
    if (!amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        message: "This booking has no valid price on file",
      });
    }

    const payerCount = group.members.length + 1; // + owner
    const totalCents = Math.round(amount * 100);
    const amountEachCents = Math.floor(totalCents / payerCount);
    // Any leftover cents from the floor division go on the owner's
    // share so the sum of all shares always equals the real charge.
    const remainderCents = totalCents - amountEachCents * payerCount;

    const owner = await User.findById(userId).select("name email").lean();

    const split = new SplitPayment({
      booking: booking._id,
      group: group._id,
      shares: [
        {
          member: null,
          user: userId,
          name: owner?.name || "Organizer",
          email: owner?.email || null,
          amountOwed: amountEachCents + remainderCents,
          currency,
        },
        ...group.members.map((m) => ({
          member: m._id,
          user: m.user || null,
          name: m.user?.name || m.name || null,
          email: m.email || null,
          amountOwed: amountEachCents,
          currency,
        })),
      ],
    });
    await split.save();

    // One PaymentIntent per share, tagged so the webhook routes it
    // to the split_share branch instead of the solo-booking branch.
    for (const share of split.shares) {
      const intent = await stripe.paymentIntents.create({
        amount: share.amountOwed,
        currency: share.currency,
        metadata: {
          kind: "split_share",
          splitPaymentId: String(split._id),
          shareId: String(share._id),
          bookingId: String(booking._id),
          groupId: String(group._id),
        },
      });
      share.stripePaymentIntentId = intent.id;
    }
    await split.save();

    group.bookingId = booking._id;
    group.status = "payment_pending";
    group.members.forEach((m) => {
      m.paymentStatus = "unpaid";
    });
    await group.save();

    return res.json({ ok: true, splitPaymentId: split._id });
  } catch (err) {
    console.error("[stripe] create-group-payment-intents error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to start group payment" });
  }
});

// ─── GET /api/stripe/split-status/:bookingId ──────────────────
// Polling fallback + initial load for PaymentProgressPanel.

router.get("/split-status/:bookingId", requireAuth, async (req, res) => {
  try {
    const split = await SplitPayment.findOne({
      booking: req.params.bookingId,
    }).lean();
    if (!split) {
      return res
        .status(404)
        .json({ ok: false, message: "No split payment for this booking" });
    }
    const allPaid =
      split.shares.length > 0 && split.shares.every((s) => s.status === "paid");
    return res.json({
      ok: true,
      splitPayments: split.shares.map((s) => ({
        memberId: s.member ? String(s.member) : null,
        status: s.status,
      })),
      allPaid,
    });
  } catch (err) {
    console.error("[stripe] split-status error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load payment status" });
  }
});

// ─── GET /api/stripe/my-split/:bookingId ───────────────────────
// Powers PaymentShareCard — the CURRENT authenticated user's own share
// of a group booking (owner or member).

router.get("/my-split/:bookingId", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const split = await SplitPayment.findOne({
      booking: req.params.bookingId,
    });
    if (!split) {
      return res
        .status(404)
        .json({ ok: false, message: "No split payment for this booking" });
    }

    const share = split.shares.find((s) => String(s.user) === String(userId));
    if (!share) {
      return res
        .status(404)
        .json({ ok: false, message: "You're not on this payment split" });
    }

    if (share.status === "paid") {
      return res.json({
        ok: true,
        status: "paid",
        amountOwed: share.amountOwed,
        clientSecret: null,
      });
    }

    // Fetch fresh from Stripe rather than persisting the client secret —
    // it can rotate if the PaymentIntent is updated.
    const intent = await stripe.paymentIntents.retrieve(
      share.stripePaymentIntentId
    );

    return res.json({
      ok: true,
      status: share.status,
      amountOwed: share.amountOwed,
      clientSecret: intent.client_secret,
    });
  } catch (err) {
    console.error("[stripe] my-split error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load your payment share" });
  }
});

export default router;
