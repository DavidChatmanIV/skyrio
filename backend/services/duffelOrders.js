// backend/services/duffelOrders.js
// Cancelling Duffel flight orders.
//
// Skyrio pays Duffel from its Duffel balance and charges the traveler with
// Stripe. When an order is cancelled the airline's refund goes back to that
// balance ("original form of payment" / "balance"), and Skyrio refunds the
// traveler's card itself. Airline credit stays with the traveler's name.
//
// Getting a cancellation quote is safe: nothing is cancelled until the quote
// is confirmed, and an unconfirmed quote just expires.

import { duffelFlights } from "../routes/api/flights/Duffelflights.provider.js";

export const isDuffelOrderId = (id) => /^ord_/.test(String(id || ""));

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The order as Duffel has it now (total paid to Duffel, status). */
export async function duffelGetOrder(orderId) {
  const { data } = await duffelFlights.get(`/air/orders/${encodeURIComponent(orderId)}`, {
    timeout: 20 * 1000,
  });
  return data?.data || null;
}

/** A cancellation quote. Cancels nothing until confirmed. */
export async function duffelCancelQuote(orderId) {
  const { data } = await duffelFlights.post(
    "/air/order_cancellations",
    { data: { order_id: orderId } },
    { timeout: 30 * 1000 }
  );
  return data?.data || null;
}

/** Confirms a quote. This cancels the order with the airline. */
export async function duffelCancelConfirm(quoteId) {
  const { data } = await duffelFlights.post(
    `/air/order_cancellations/${encodeURIComponent(quoteId)}/actions/confirm`,
    {},
    { timeout: 60 * 1000 }
  );
  return data?.data || null;
}

/**
 * What the traveler gets back, from a Duffel quote.
 *   paid = what the traveler paid Skyrio (Stripe)
 *   net  = what Skyrio paid Duffel for the order
 * A full airline refund gives the traveler everything back, Skyrio's fee
 * included. A partial one gives back what the airline returns, up to what
 * they paid.
 */
export function duffelRefundTerms(quote, { paid, net }) {
  const to = String(quote?.refund_to || "").toLowerCase();
  const supplierRefund = round2(quote?.refund_amount);
  const currency = String(quote?.refund_currency || "USD").toUpperCase();
  if (to === "airline_credits" || to === "voucher") {
    return {
      refundTo: "airline_credit",
      supplierRefund,
      customerRefund: 0,
      full: false,
      currency,
      airlineCredit: {
        amount: supplierRefund,
        currency,
        vouchers: (quote?.airline_credits || []).map((c) => ({
          amount: Number(c.credit_amount) || null,
          currency: c.credit_currency || currency,
          code: c.credit_code || null,
          expiresAt: c.expires_at || null,
        })),
      },
    };
  }
  const toCard = to === "original_form_of_payment" || to === "balance";
  const full = toCard && Number(net) > 0 && supplierRefund >= Number(net) - 0.01;
  return {
    refundTo: toCard ? "card" : null,
    supplierRefund,
    customerRefund: toCard ? round2(full ? paid : Math.min(supplierRefund, paid)) : 0,
    full,
    currency,
    airlineCredit: null,
  };
}
