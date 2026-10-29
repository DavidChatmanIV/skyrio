// Checkout tokens: proof that this browser started a checkout.
//
// Guests can book without an account, so the backend hands back a
// checkout token when a fare or room is held, and every later step of
// that checkout sends it as the X-Checkout-Token header.
//
// Flight tokens are kept in sessionStorage, keyed by the prebookId, so
// they survive a refresh and the /checkout/flight/complete return page.

const key = (kind, ref) => `skyrio_checkout_token:${kind}:${ref}`;

export function saveCheckoutToken(kind, ref, token) {
  try {
    if (ref && token) sessionStorage.setItem(key(kind, ref), token);
  } catch {
    // private browsing / quota: non-fatal
  }
}

export function getCheckoutToken(kind, ref) {
  try {
    return ref ? sessionStorage.getItem(key(kind, ref)) : null;
  } catch {
    return null;
  }
}

export function clearCheckoutToken(kind, ref) {
  try {
    if (ref) sessionStorage.removeItem(key(kind, ref));
  } catch {
    // non-fatal
  }
}

// Headers for checkout requests: the login token only when someone is
// signed in (never "Bearer null"), plus the checkout token when the
// request belongs to a checkout.
export function apiHeaders(checkoutToken) {
  let token = null;
  try {
    token = localStorage.getItem("token");
  } catch {
    // storage blocked: continue as a guest
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(checkoutToken ? { "X-Checkout-Token": checkoutToken } : {}),
  };
}
