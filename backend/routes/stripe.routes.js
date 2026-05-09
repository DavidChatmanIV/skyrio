import express, { Router } from "express";
import Stripe from "stripe";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/stripe/webhook
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

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const bookingId = intent.metadata?.bookingId;
      const userId = intent.metadata?.userId;

      try {
        // 1. Confirm booking in DB
        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            $set: {
              status: "confirmed",
              paidAt: new Date(),
              paymentIntentId: intent.id,
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

        console.log(`✅ Booking confirmed: ${bookingId}`);
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    }

    res.json({ received: true });
  }
);

// POST /api/stripe/create-payment-intent
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency = "usd", bookingId, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: {
        bookingId: bookingId || "",
        userId: userId || "",
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("PaymentIntent error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
