import { Router } from "express";
import Stripe from "stripe";
import SplitPayment from "../models/SplitPayment.js";
import Booking from "../models/booking.js";
import SyncGroup from "../models/SyncGroup.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── GET /api/split-payments/:splitPaymentId/shares/:shareId/client-secret ───
// PUBLIC — deliberately no auth. Reached via a direct link sent to a
// specific traveler (PayShare.jsx); anyone with the link can pay that
// one share, same trust model as the sync-together invite/join routes.
// Never exposes other shares or anything about the rest of the group.

router.get(
  "/:splitPaymentId/shares/:shareId/client-secret",
  async (req, res) => {
    try {
      const { splitPaymentId, shareId } = req.params;

      const split = await SplitPayment.findById(splitPaymentId);
      if (!split) {
        return res.status(404).json({
          ok: false,
          message: "This payment link isn't valid anymore.",
        });
      }

      const share = split.shares.id(shareId);
      if (!share) {
        return res.status(404).json({
          ok: false,
          message: "This payment link isn't valid anymore.",
        });
      }

      // A share can still legitimately be "paid" even after the group
      // as a whole has moved to a terminal state (e.g. this traveler
      // paid before expiry, others didn't) — that branch must win over
      // the group-level check below so a paid receipt still renders.
      const [booking, group] = await Promise.all([
        Booking.findById(split.booking).select("tripDetails type").lean(),
        SyncGroup.findById(split.group).select("title destination").lean(),
      ]);

      const label =
        group?.title && group.title !== "Untitled Trip"
          ? group.title
          : booking?.tripDetails || "Group trip";

      if (share.status === "paid") {
        return res.json({
          ok: true,
          status: "paid",
          amount: share.amountOwed / 100,
          currency: (share.currency || "usd").toUpperCase(),
          label,
          assignedName: share.name || share.email || "Traveler",
          clientSecret: null,
        });
      }

      // Guards against serving a live client secret for a split whose
      // group-level status has already gone terminal (expired/cancelled,
      // or paid-in-full-but-booking-failed) while this particular share
      // never got flipped off its pre-expiry status. Without this, a
      // late payer could pay into a booking that will never be created,
      // with no automatic refund path for that payment.
      if (split.status === "cancelled" || split.status === "booking_failed") {
        return res.status(410).json({
          ok: false,
          message: "This split payment is no longer active.",
        });
      }

      if (!share.stripePaymentIntentId) {
        return res.status(400).json({
          ok: false,
          message: "This payment isn't ready yet — please check back shortly.",
        });
      }

      // Fetch fresh rather than persisting the client secret — same
      // reasoning as the authed /api/stripe/my-split/:bookingId route.
      const intent = await stripe.paymentIntents.retrieve(
        share.stripePaymentIntentId
      );

      return res.json({
        ok: true,
        status: share.status,
        amount: share.amountOwed / 100,
        currency: (share.currency || "usd").toUpperCase(),
        label,
        assignedName: share.name || share.email || "Traveler",
        clientSecret: intent.client_secret,
      });
    } catch (err) {
      console.error("[split-payments] client-secret error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load your payment details" });
    }
  }
);

export default router;
