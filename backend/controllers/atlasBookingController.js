// backend/controllers/atlasBookingController.js
// The ONLY path from an Atlas proposal to a real charge + booking.
// Triggered by the user's tap, never by the model.
import Stripe from "stripe";
import AtlasBookingProposal from "../models/AtlasBookingProposal.js";
import User from "../models/user.js";
import { getFlightPrebook, completeFlightBooking } from "../providers/liteapi/flights.js";
import { getHotelPrebook, completeHotelBooking } from "../providers/liteapi/hotels.js";
import { markMemberSharePaid } from "../services/syncTogether/payments.js"; // your existing split-pay helper
import { io } from "../socket.js";
import { learnFromBooking } from "../services/atlas/atlasLearning.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const publicView = (p) => ({
  id: String(p._id),
  kind: p.kind,
  summary: p.summary,
  amount: p.amount,
  currency: p.currency,
  status: p.isExpired() && p.status === "pending" ? "expired" : p.status,
  expiresAt: p.expiresAt,
  syncTrip: p.syncTrip,
  bookingRef: p.bookingRef,
  failureReason: p.failureReason,
});

// GET /api/atlas/proposals/:id
export async function getProposal(req, res) {
  const p = await AtlasBookingProposal.findOne({ _id: req.params.id, user: req.user.id });
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(publicView(p));
}

// POST /api/atlas/proposals/:id/cancel
export async function cancelProposal(req, res) {
  const p = await AtlasBookingProposal.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id, status: "pending" },
    { status: "cancelled" },
    { new: true }
  );
  if (!p) return res.status(409).json({ error: "This can't be cancelled anymore" });
  res.json(publicView(p));
}

// POST /api/atlas/proposals/:id/confirm
export async function confirmProposal(req, res) {
  const p = await AtlasBookingProposal.findOne({ _id: req.params.id, user: req.user.id });
  if (!p) return res.status(404).json({ error: "Not found" });
  if (p.status !== "pending") return res.status(409).json(publicView(p));
  if (p.isExpired()) {
    p.status = "expired";
    await p.save();
    return res.status(410).json({ ...publicView(p), error: "This price expired. Ask Atlas to search again." });
  }

  // 1) Re-check the live price. Never charge a number the user didn't see.
  const live = p.kind === "flight" ? await getFlightPrebook(p.prebookId) : await getHotelPrebook(p.prebookId);
  const liveTotal = p.sharedRoomId ? live.perPersonShare : live.price.total;
  const liveAmount = Math.round(liveTotal * 100);
  if (liveAmount !== p.amount) {
    p.status = "price_changed";
    p.failureReason = `Price changed from ${p.amount / 100} to ${liveTotal}`;
    await p.save();
    return res.status(409).json({ ...publicView(p), newTotal: liveTotal });
  }

  // 2) Lock it so a double tap can't charge twice
  const locked = await AtlasBookingProposal.findOneAndUpdate(
    { _id: p._id, status: "pending" },
    { status: "processing" },
    { new: true }
  );
  if (!locked) return res.status(409).json({ error: "Already processing" });

  // 3) Charge the saved card (user is present, so 3D Secure can run if the bank asks)
  const user = await User.findById(req.user.id).lean();
  let pi;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: locked.amount,
        currency: locked.currency,
        customer: user.stripeCustomerId,
        payment_method: user.defaultPaymentMethodId,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/atlas?proposal=${locked._id}`,
        metadata: {
          source: "atlas",
          proposalId: String(locked._id),
          kind: locked.kind,
          syncTripId: locked.syncTrip ? String(locked.syncTrip) : "",
        },
      },
      { idempotencyKey: `atlas-proposal-${locked._id}` }
    );
  } catch (err) {
    locked.status = "failed";
    locked.failureReason = err.message;
    await locked.save();
    return res.status(402).json({ ...publicView(locked), error: "Your card was declined. Try another card in Settings." });
  }

  locked.paymentIntentId = pi.id;

  if (pi.status === "requires_action") {
    locked.status = "requires_action";
    await locked.save();
    // Frontend runs stripe.handleNextAction({ clientSecret }) then calls /finalize
    return res.json({ ...publicView(locked), clientSecret: pi.client_secret });
  }

  await locked.save();
  const result = await finalizeProposal(locked._id);
  res.status(result.status === "booked" ? 200 : 502).json(publicView(result));
}

// POST /api/atlas/proposals/:id/finalize  (after 3D Secure)
export async function finalizeAfterAction(req, res) {
  const p = await AtlasBookingProposal.findOne({ _id: req.params.id, user: req.user.id });
  if (!p) return res.status(404).json({ error: "Not found" });
  const result = await finalizeProposal(p._id);
  res.json(publicView(result));
}

// Idempotent: safe to call from the confirm route, /finalize, AND the Stripe webhook.
export async function finalizeProposal(proposalId) {
  const p = await AtlasBookingProposal.findById(proposalId);
  if (!p || p.status === "booked") return p;

  const pi = await stripe.paymentIntents.retrieve(p.paymentIntentId);
  if (pi.status !== "succeeded") return p;

  try {
    const booking =
      p.kind === "flight"
        ? await completeFlightBooking({ prebookId: p.prebookId, userId: p.user, paymentIntentId: pi.id, source: "atlas" })
        : await completeHotelBooking({
            prebookId: p.prebookId,
            userId: p.user,
            paymentIntentId: pi.id,
            sharedRoomId: p.sharedRoomId,
            source: "atlas",
          });

    p.status = "booked";
    p.bookingRef = booking._id;
    await p.save();

    // Sync Together: mark only this member's share paid; others are unaffected
    if (p.syncTrip) {
      await markMemberSharePaid({ syncTripId: p.syncTrip, userId: p.user, bookingId: booking._id, kind: p.kind });
    }

    io.to(`user:${p.user}`).emit("atlas:booking", { proposalId: String(p._id), status: "booked" });

    // Atlas learns from the trip once it's really booked (never blocks the booking)
    if (p.learnSummary) learnFromBooking(p.user, p.learnSummary).catch(() => {});
    return p;
  } catch (err) {
    // Charged but the provider failed: refund right away, don't leave the user paying for nothing
    await stripe.refunds.create({ payment_intent: pi.id }, { idempotencyKey: `atlas-refund-${p._id}` });
    p.status = "failed";
    p.failureReason = `Booking failed after payment; refunded. ${err.message}`;
    await p.save();
    io.to(`user:${p.user}`).emit("atlas:booking", { proposalId: String(p._id), status: "failed" });
    return p;
  }
}
