import jwt from "jsonwebtoken";

// ─────────────────────────────────────────────────────────────
// Checkout tokens
//
// Guests can book without an account, so "who owns this checkout" can't
// come from the login token anymore. When a fare (flight prebook) or a
// room (hotel PaymentIntent) is held, the backend hands back a short-lived
// checkout token. Every later step of that checkout must send it in the
// X-Checkout-Token header.
//
// Signed with a DIFFERENT secret than login tokens, so a checkout token
// can never be accepted by requireAuth as a login.
// ─────────────────────────────────────────────────────────────

const secret = () =>
  process.env.CHECKOUT_TOKEN_SECRET || `${process.env.JWT_SECRET}:checkout`;

export function currentUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

// kind: "flight" | "hotel"
// refs: the ids this checkout owns (flight prebookId, or hotel PaymentIntent id)
export function signCheckoutToken({ kind, refs, ownerId, email }) {
  return jwt.sign(
    { k: kind, refs: refs.map(String), o: ownerId || null, e: email || null },
    secret(),
    { expiresIn: "3h" }
  );
}

export function readCheckoutToken(req, kind) {
  const raw = req.get("x-checkout-token") || req.body?.checkoutToken;
  if (!raw) return null;
  try {
    const d = jwt.verify(raw, secret());
    return d.k === kind ? d : null;
  } catch {
    return null;
  }
}

// True when the token covers this ref and, if the checkout was started
// signed in, that same account is still the one signed in.
export function ownsCheckout(token, req, ref) {
  if (!token || !token.refs?.includes(String(ref))) return false;
  if (token.o && token.o !== currentUserId(req)) return false;
  return true;
}

export const CHECKOUT_ENDED = {
  ok: false,
  code: "CHECKOUT_ENDED",
  message:
    "This checkout session ended. Please pick your flight or room again.",
};
