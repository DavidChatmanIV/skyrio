// Skyrio's own Stripe (hotels + shared rooms).
//
// Gets the publishable key the same way flight payments already do:
//   1. from the frontend build (VITE_STRIPE_PUBLIC_KEY or
//      VITE_STRIPE_PUBLISHABLE_KEY), if Vercel baked one in;
//   2. otherwise from the backend at runtime (GET /api/stripe-config, which
//      reads STRIPE_PUBLISHABLE_KEY on Render).
// So the live site works even when the Vercel build has no key.
// A publishable key (pk_…) is safe to expose — it can't move money.
import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const API = import.meta.env.VITE_API_URL || "";
const clean = (k) =>
  String(k || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const BUILD_KEY = clean(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

let stripePromise = null;

// One Stripe instance for the whole app. Resolves to null if no key exists
// anywhere (the card form then shows a clear message instead of a blank box).
export function getSkyrioStripe() {
  if (stripePromise) return stripePromise;
  stripePromise = (async () => {
    let key = BUILD_KEY.startsWith("pk_") ? BUILD_KEY : null;
    if (!key) {
      try {
        const res = await fetch(`${API}/api/stripe-config`);
        const data = await res.json().catch(() => ({}));
        const fromServer = clean(data?.publishableKey);
        if (fromServer.startsWith("pk_")) key = fromServer;
      } catch {
        /* handled below */
      }
    }
    if (!key) {
      console.error(
        "[payments] No Stripe publishable key: not in the build (VITE_STRIPE_PUBLIC_KEY / VITE_STRIPE_PUBLISHABLE_KEY) and not from the server (STRIPE_PUBLISHABLE_KEY on Render)."
      );
      stripePromise = null; // let a later page try again
      return null;
    }
    return loadStripe(key);
  })();
  return stripePromise;
}

// "loading" | "ready" | "missing"
export function useSkyrioStripeStatus() {
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let alive = true;
    getSkyrioStripe()
      .then((s) => alive && setStatus(s ? "ready" : "missing"))
      .catch(() => alive && setStatus("missing"));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
