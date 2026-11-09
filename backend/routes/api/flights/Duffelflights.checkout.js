// backend/routes/api/flights/Duffelflights.checkout.js
// Checkout for Duffel fares. Same pattern as hotels (hotelPayments.routes.js):
//
//   1. POST /api/flights/duffel/intent
//        Re-reads the offer, creates a Stripe PaymentIntent with MANUAL capture
//        (the card is only authorized), returns clientSecret + checkoutToken.
//   2. Traveler pays with Stripe on the frontend (card authorized, not charged).
//   3. POST /api/flights/duffel/complete
//        Re-checks the price, creates the Duffel order (paid from Skyrio's
//        Duffel balance), then CAPTURES the card. If Duffel can't book, the
//        hold is CANCELLED and the traveler is never charged.
//
// Env: STRIPE_SECRET_KEY, DUFFEL_ACCESS_TOKEN, DUFFEL_MARKUP_PCT (optional).

import Stripe from "stripe";
import DuffelFlightCheckout from "../../../models/DuffelFlightCheckout.js";
import {
  duffelFlights,
  getDuffelOffer,
  isDuffelOfferId,
  isDuffelSoldOut,
} from "./Duffelflights.provider.js";
import { duffelSellPrice } from "./Duffelflights.utils.js";
import { saveFlightBooking } from "./Liteapiflights.controller.js";
import { sendBookingConfirmation } from "../../../services/email.js";
import { manageUrlFor } from "../../../services/manageLink.js";
import {
  recordEmailResult,
  sendConfirmationFor,
  onGroupBookingSaved,
} from "../../../services/bookingConfirmations.js";
import {
  signCheckoutToken,
  readCheckoutToken,
  ownsCheckout,
  currentUserId,
  CHECKOUT_ENDED,
} from "../../../services/checkoutToken.js";

let _stripe;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toCents = (amount) => Math.round(Number(amount) * 100);

const SOLD_OUT = {
  ok: false,
  soldOut: true,
  message: "This fare just sold out with the airline. Please pick another flight.",
};
const NOT_CHARGED = "Your card was not charged.";

function fail(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, message, ...extra });
}

// Age on a date, in whole years.
function ageOn(dob, onDate) {
  const b = new Date(`${dob}T00:00:00Z`);
  const d = new Date(onDate);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

// Checkout travelers → Duffel order passengers (ids come from the offer).
function toOrderPassengers(offer, passengers, contact) {
  const offerPax = offer.passengers || [];
  if (passengers.length !== offerPax.length) {
    return {
      error: `This fare was priced for ${offerPax.length} traveler${
        offerPax.length === 1 ? "" : "s"
      }. Go back and search again with the right number of travelers.`,
    };
  }
  const firstDeparture = offer.slices?.[0]?.segments?.[0]?.departing_at || Date.now();
  const out = [];
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i] || {};
    const given = String(p.firstName || "").trim();
    const family = String(p.lastName || "").trim();
    const gender = String(p.gender || "").toUpperCase();
    if (!given || !family) return { error: "Enter each traveler's first and last name." };
    if (!DATE_RE.test(String(p.dob || ""))) return { error: "Enter each traveler's date of birth." };
    if (gender !== "M" && gender !== "F") return { error: "Select each traveler's gender." };
    // Skyrio searches Duffel for adults only; Duffel adults are 18+.
    if (offerPax[i]?.type === "adult" && ageOn(p.dob, firstDeparture) < 18) {
      return {
        error:
          "This fare is for adults (18+). For travelers under 18, go back and search again including them as children.",
      };
    }
    out.push({
      id: offerPax[i].id,
      title: gender === "F" ? "ms" : "mr",
      gender: gender === "F" ? "f" : "m",
      given_name: given,
      family_name: family,
      born_on: p.dob,
      // Duffel needs contact details on every traveler; the lead's are used.
      email: contact.email,
      phone_number: contact.phone,
    });
  }
  return { passengers: out };
}

/**
 * POST /api/flights/duffel/intent
 * Body: { offerId, contact: { email, phone (E.164) }, passengers: [{ firstName, lastName, dob, gender }], groupId? }
 */
export async function createDuffelIntent(req, res) {
  try {
    const { offerId, contact = {}, passengers = [], groupId = null } = req.body || {};
    if (!isDuffelOfferId(offerId)) return fail(res, 400, "A Duffel offerId is required.");

    const email = String(contact.email || "").trim().toLowerCase();
    const phone = String(contact.phone || "").replace(/[\s()-]/g, "");
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email so we can send your confirmation.");
    if (!E164_RE.test(phone)) return fail(res, 400, "Enter a valid phone number, including the country code.");
    if (!Array.isArray(passengers) || !passengers.length) return fail(res, 400, "Add at least one traveler.");

    let offer;
    try {
      offer = await getDuffelOffer(offerId);
    } catch (err) {
      if (isDuffelSoldOut(err)) return res.status(409).json(SOLD_OUT);
      throw err;
    }
    if (!offer || (offer.expires_at && Date.parse(offer.expires_at) <= Date.now())) {
      return res.status(409).json(SOLD_OUT);
    }

    const currency = String(offer.total_currency || "").toUpperCase();
    const netAmount = Number(offer.total_amount);
    const sellAmount = duffelSellPrice(netAmount);
    if (currency !== "USD" || !(sellAmount > 0)) {
      return fail(res, 409, "This fare can't be booked in US dollars. Please pick another flight.");
    }

    const mapped = toOrderPassengers(offer, passengers, { email, phone });
    if (mapped.error) return fail(res, 400, mapped.error, { travelerDetails: true });

    const userId = currentUserId(req) || null;
    const intent = await stripe().paymentIntents.create({
      amount: toCents(sellAmount),
      currency: "usd",
      capture_method: "manual", // authorize only — captured after Duffel books
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: email,
      description: "Skyrio flight",
      metadata: { kind: "duffel_flight", offerId, userId: userId ? String(userId) : "guest" },
    });

    await DuffelFlightCheckout.create({
      user: userId,
      email,
      offerId,
      paymentIntentId: intent.id,
      sellAmount,
      netAmount,
      currency,
      orderPassengers: mapped.passengers,
      groupId: userId ? groupId : null,
    });

    const checkoutToken = signCheckoutToken({
      kind: "flight",
      refs: [intent.id],
      ownerId: userId,
      email,
    });

    return res.status(200).json({
      ok: true,
      checkoutId: intent.id,
      clientSecret: intent.client_secret,
      total: sellAmount,
      currency,
      expiresAt: offer.expires_at || null,
      checkoutToken,
    });
  } catch (err) {
    console.error("[duffel/intent] failed:", err?.response?.data?.errors?.[0] || err.message);
    return fail(res, 502, "We couldn't set up payment for this fare. Please try again in a moment.");
  }
}

// Duffel validation errors about names/details → the same wording LiteAPI
// checkout uses, so the frontend's "Fix traveler names" button appears.
function orderErrorMessage(err) {
  const e = err?.response?.data?.errors?.[0] || {};
  const text = `${e.code || ""} ${e.title || ""} ${e.message || ""} ${e.source?.field || ""}`;
  if (/given_name|family_name|name/i.test(text)) {
    return "The airline didn't accept a traveler's name. Enter each name exactly as it appears on that person's ID, then try again.";
  }
  if (/born_on|phone|email|gender|title/i.test(text)) {
    return "The airline didn't accept the traveler details. Please check them and try again.";
  }
  return null;
}

/**
 * POST /api/flights/duffel/complete
 * Body: { checkoutId, confirmationEmail?, groupId? }   Header: X-Checkout-Token
 */
export async function completeDuffelBooking(req, res) {
  const { checkoutId, confirmationEmail = {}, groupId } = req.body || {};
  if (!checkoutId) return fail(res, 400, "checkoutId is required");

  const token = readCheckoutToken(req, "flight");
  if (!ownsCheckout(token, req, checkoutId)) return res.status(403).json(CHECKOUT_ENDED);

  const session = await DuffelFlightCheckout.findOne({ paymentIntentId: checkoutId }).catch(() => null);
  if (!session) return fail(res, 404, "Checkout not found. Please start again.");
  if (session.status === "BOOKED") {
    return res.json({ ok: true, duplicate: true, booking: session.bookingId ? { _id: session.bookingId } : null });
  }
  if (session.status === "BOOKING" || session.status === "NEEDS_RECONCILE") {
    return res.status(202).json({ ok: false, pending: true, message: "We're still confirming your booking. Check your email or My Trips shortly." });
  }
  if (session.status === "FAILED") return fail(res, 409, `This checkout ended. ${NOT_CHARGED}`);

  let intent;
  try {
    intent = await stripe().paymentIntents.retrieve(checkoutId);
  } catch (err) {
    return fail(res, 502, "We couldn't reach the payment system. Please try again.");
  }
  if (intent.status !== "requires_capture") {
    return fail(res, 400, "Your payment isn't authorized yet. Please complete the card step.");
  }

  // Lock: only one request may book this checkout.
  const locked = await DuffelFlightCheckout.findOneAndUpdate(
    { paymentIntentId: checkoutId, status: "PENDING" },
    { status: "BOOKING" },
    { new: true }
  );
  if (!locked) return res.status(202).json({ ok: false, pending: true, message: "Your booking is already being confirmed." });

  const cancelHold = async (reason) => {
    await stripe().paymentIntents.cancel(checkoutId).catch(() => {});
    locked.status = "FAILED";
    locked.error = reason;
    await locked.save().catch(() => {});
  };

  // Re-check the fare right before booking.
  let offer;
  try {
    offer = await getDuffelOffer(locked.offerId);
  } catch (err) {
    await cancelHold(err.message);
    if (isDuffelSoldOut(err)) return res.status(409).json({ ...SOLD_OUT, message: `${SOLD_OUT.message} ${NOT_CHARGED}` });
    return fail(res, 502, `The airline's system didn't respond. ${NOT_CHARGED} Please try again.`);
  }
  const netNow = Number(offer?.total_amount);
  const sellNow = duffelSellPrice(netNow);
  if (String(offer?.total_currency).toUpperCase() !== locked.currency || !(sellNow > 0)) {
    await cancelHold("currency/price unreadable at complete");
    return fail(res, 409, `This fare changed and can't be booked. ${NOT_CHARGED}`);
  }
  if (sellNow > locked.sellAmount + 0.009) {
    await cancelHold(`price rose ${locked.sellAmount} → ${sellNow}`);
    return fail(
      res,
      409,
      `The airline raised this fare to $${sellNow.toFixed(2)} before we could book it. ${NOT_CHARGED} Go back to see the new price.`,
      { priceChanged: true, previousPrice: locked.sellAmount, newPrice: sellNow }
    );
  }

  // Create the Duffel order, paid from Skyrio's Duffel balance.
  let order;
  try {
    const { data } = await duffelFlights.post(
      "/air/orders",
      {
        data: {
          type: "instant",
          selected_offers: [locked.offerId],
          passengers: locked.orderPassengers,
          payments: [{ type: "balance", currency: offer.total_currency, amount: offer.total_amount }],
          metadata: { skyrio_checkout: checkoutId },
        },
      },
      { timeout: 60 * 1000 }
    );
    order = data?.data;
    if (!order?.id) throw new Error("Duffel returned no order id");
  } catch (err) {
    // No answer from Duffel = the order MAY exist. Keep the hold (it lasts
    // ~7 days) and flag it; never release a hold for a ticket that might exist.
    if (!err?.response) {
      locked.status = "NEEDS_RECONCILE";
      locked.error = `order request got no response: ${err.message}`;
      await locked.save().catch(() => {});
      console.error("[duffel/complete] RECONCILE (no response from Duffel)", checkoutId, err.message);
      return res.status(202).json({
        ok: false,
        pending: true,
        message: "We're confirming your booking with the airline. You'll get an email shortly — please don't book again.",
      });
    }
    const code = err.response.data?.errors?.[0]?.code || "";
    await cancelHold(`order failed: ${code || err.message}`);
    if (/insufficient_balance/i.test(code)) {
      console.error("[duffel/complete] DUFFEL BALANCE TOO LOW — top up the Duffel balance");
    }
    if (isDuffelSoldOut(err)) return res.status(409).json({ ...SOLD_OUT, message: `${SOLD_OUT.message} ${NOT_CHARGED}` });
    const detailMsg = orderErrorMessage(err);
    if (detailMsg) return fail(res, 400, `${detailMsg} ${NOT_CHARGED}`, { travelerDetails: true });
    return fail(res, 502, `The airline couldn't confirm this booking. ${NOT_CHARGED} Please try another flight.`);
  }

  // Ticket exists now — capture. Never cancel past this point.
  try {
    await stripe().paymentIntents.capture(checkoutId);
  } catch (err) {
    locked.status = "NEEDS_RECONCILE";
    locked.duffelOrderId = order.id;
    locked.bookingReference = order.booking_reference || null;
    locked.error = `capture failed: ${err.message}`;
    await locked.save().catch(() => {});
    console.error("[duffel/complete] RECONCILE (capture failed)", checkoutId, err.message);
    return res.status(500).json({
      ok: false,
      message: "Your flight is booked and we're finalizing payment. Check your email or My Trips shortly.",
    });
  }

  const userId = currentUserId(req) || "";
  const pnr = order.booking_reference || null;
  const saved = await saveFlightBooking({
    userId,
    prebookId: checkoutId,
    transactionId: checkoutId,
    record: null,
    email: { ...confirmationEmail, totalAmount: locked.sellAmount, currency: locked.currency },
    groupId: userId ? groupId || locked.groupId : null,
    fallbackEmail: locked.email,
    provider: "duffel",
    pnrOverride: pnr,
    bookingIdOverride: order.id,
    travelers: locked.orderPassengers.map((p) => ({ name: `${p.given_name} ${p.family_name}`, type: "adult" })),
  });

  locked.status = "BOOKED";
  locked.duffelOrderId = order.id;
  locked.bookingReference = pnr;
  locked.bookingId = saved?._id || null;
  await locked.save().catch(() => {});

  // Confirmation email — same template as LiteAPI flights.
  const to = confirmationEmail?.to || locked.email;
  if (saved) {
    const emailPromise = to
      ? sendBookingConfirmation({
          to,
          passengerName: confirmationEmail.passengerName,
          confirmationNumber: pnr || order.id,
          confirmationIsAirline: Boolean(pnr),
          airline: confirmationEmail.airline,
          flightNumber: confirmationEmail.flightNumber,
          returnFlightNumber: confirmationEmail.returnFlightNumber,
          origin: confirmationEmail.origin,
          destination: confirmationEmail.destination,
          originName: confirmationEmail.originName,
          destinationName: confirmationEmail.destinationName,
          departureAt: confirmationEmail.departureAt,
          arrivalAt: confirmationEmail.arrivalAt,
          returnDepartureAt: confirmationEmail.returnDepartureAt,
          returnArrivalAt: confirmationEmail.returnArrivalAt || confirmationEmail.returnArrivingAt,
          totalAmount: locked.sellAmount,
          currency: locked.currency,
          cabinClass: confirmationEmail.cabinClass,
          travelerCount: locked.orderPassengers.length,
          groupTrip: Boolean(userId && groupId),
          manageUrl: manageUrlFor(saved._id),
        }).catch((e) => ({ ok: false, error: e?.message || "send failed" }))
      : null;
    (emailPromise ? emailPromise.then((r) => recordEmailResult(saved._id, to, r)) : sendConfirmationFor(saved))
      .catch(() => {})
      .finally(() => {
        if (saved.syncGroup) onGroupBookingSaved(saved);
      });
  }

  return res.status(200).json({
    ok: true,
    provider: "duffel",
    data: { bookingId: order.id, bookingReference: pnr },
    booking: saved ? { _id: saved._id } : null,
  });
}
