// Flight payment step. The prebook's secretKey belongs to a PaymentIntent on
// LiteAPI's Stripe account, so it must be rendered with a key from THAT
// account — Skyrio's own publishable key can't load it.
//
// Strategy (automatic, in order):
//   1. VITE_LITEAPI_STRIPE_PK is set  → mount Stripe's card form directly
//      with that key (most reliable once you have the key).
//   1b. Otherwise ask the backend (GET /api/flight-payments/config) for the
//      key. This is what makes the live site work without any Vercel
//      variable: the key comes from Render at runtime.
//   2. Otherwise → try LiteAPI's payment SDK.
//   3. If the SDK renders nothing within 12s → look up the publishable key
//      the SDK itself requested from Stripe, and mount Stripe's card form
//      directly with it.
//   4. If no key can be found → show a clear error (never an empty box).
//
// After payment, the traveler goes to /checkout/flight/complete, which
// finalizes the booking with /api/flights/complete. Everything that page
// needs is saved to sessionStorage first.
//
// Env (local .env + Vercel):
//   VITE_LITEAPI_ENV       = "sandbox" | "live"
//   VITE_LITEAPI_STRIPE_PK = (optional) LiteAPI's Stripe publishable key

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Check, AlertTriangle } from "lucide-react";

const SDK_SRC =
  "https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1";
const TARGET_ID = "skyrio-liteapi-payment";
const SDK_TIMEOUT_MS = 12000;
export const PENDING_FLIGHT_PAYMENT_KEY = "skyrio_pending_flight_payment";
const RETURN_PATH = "/checkout/flight/complete";

const stripePromises = new Map(); // one Stripe instance per publishable key
function getStripe(pk) {
  if (!stripePromises.has(pk)) stripePromises.set(pk, loadStripe(pk));
  return stripePromises.get(pk);
}

function loadSdk() {
  if (window.LiteAPIPayment) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let s = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = SDK_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener(
      "error",
      () =>
        reject(
          new Error("The payment form couldn't load. Refresh and try again.")
        ),
      { once: true }
    );
    if (window.LiteAPIPayment) resolve();
  });
}

// Stripe IDs embed part of the owning account's ID. In "pi_3ULn8sA4FXPoRk9Y…"
// the account fragment is "A4FXPoRk9Y" (10 chars after the first 6). A
// publishable key from the same account contains that same fragment.
function accountFragment(secret) {
  const id = String(secret || "").split("_secret")[0]; // pi_xxxxxx…
  return id.startsWith("pi_") && id.length >= 19 ? id.slice(9, 19) : null;
}

// Finds a publishable key in the page's Stripe network requests that belongs
// to the SAME Stripe account as this payment. Skyrio's own key (used on other
// pages) is ignored automatically because its account fragment won't match.
function findPublishableKeyFromNetwork(secret) {
  const frag = accountFragment(secret);
  if (!frag) return null;
  try {
    const keys = performance
      .getEntriesByType("resource")
      .map((e) => (e.name.match(/pk_(test|live)_[A-Za-z0-9]+/) || [])[0])
      .filter(Boolean);
    return keys.find((k) => k.includes(frag)) || null;
  } catch {
    return null;
  }
}

// Strips spaces/quotes a dashboard paste can add ("pk_…" or pk_… ).
const cleanKey = (k) =>
  String(k || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim() || null;

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
async function fetchPaymentConfig() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/flight-payments/config`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`config ${res.status}`);
  return res.json();
}

const fullName = (p) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const piOf = (secret) => String(secret || "").split("_secret")[0];

// ── Fonts inside the payment form ───────────────────────────────────────────
// Stripe's fields live in an iframe, so `fontFamily: "inherit"` inherits the
// iframe's default (Times New Roman), not Skyrio's font. Instead we read the
// font the page actually uses and hand Stripe the same Google Fonts
// stylesheet(s) the page loaded, plus a system sans-serif fallback so it can
// never fall back to serif.
const SANS_FALLBACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function pageFontFamily() {
  try {
    const f = window.getComputedStyle(document.body).fontFamily || "";
    if (!f || /^\s*["']?(serif|times)/i.test(f)) return SANS_FALLBACK;
    return `${f}, ${SANS_FALLBACK}`;
  } catch {
    return SANS_FALLBACK;
  }
}

function pageFontSources() {
  try {
    return Array.from(
      document.querySelectorAll(
        'link[rel="stylesheet"][href*="fonts.googleapis.com"]'
      )
    )
      .map((l) => l.href)
      .filter((href) => /^https:\/\//.test(href))
      .map((cssSrc) => ({ cssSrc }));
  } catch {
    return [];
  }
}

function buildStripeAppearance(fontFamily) {
  return {
    theme: "night",
    variables: {
      colorPrimary: "#f97316",
      colorBackground: "#100c22",
      colorText: "#ffffff",
      colorDanger: "#f87171",
      borderRadius: "10px",
      fontFamily,
    },
    rules: {
      ".Input": {
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
      },
      ".Input:focus": {
        border: "1px solid #f97316",
        boxShadow: "0 0 0 3px rgba(249,115,22,0.35)",
      },
      ".Label": { color: "rgba(255,255,255,0.5)", fontSize: "12px" },
    },
  };
}

// ── Direct Stripe card form (fallback / preferred when key is known) ─────────
const ZERO_DECIMAL = new Set([
  "jpy",
  "krw",
  "vnd",
  "clp",
  "isk",
  "ugx",
  "xof",
  "xaf",
]);

function DirectStripeForm({ clientSecret, total, email, onError, onAmount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [exact, setExact] = useState(null); // { amount, currency } from Stripe

  // The exact amount on the payment — this is what the card is charged.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    let cancelled = false;
    stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent }) => {
        if (cancelled || !paymentIntent) return;
        const cur = String(paymentIntent.currency || "usd").toLowerCase();
        const amount = ZERO_DECIMAL.has(cur)
          ? paymentIntent.amount
          : paymentIntent.amount / 100;
        setExact({ amount, currency: cur.toUpperCase() });
        onAmount?.(amount, cur.toUpperCase());
      })
      .catch((e) => console.error("[pay] couldn't read payment amount:", e));
    return () => {
      cancelled = true;
    };
  }, [stripe, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownAmount = exact?.amount ?? Number(total || 0);
  const fmt = (n) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: exact?.currency || "USD",
    }).format(n);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    onError("");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${RETURN_PATH}`,
        ...(email && { receipt_email: email }),
      },
      redirect: "if_required",
    });
    if (error) {
      onError(error.message || "Your payment didn't go through.");
      setBusy(false);
      return;
    }
    if (
      paymentIntent?.status === "succeeded" ||
      paymentIntent?.status === "requires_capture"
    ) {
      window.location.assign(`${RETURN_PATH}?redirect_status=succeeded`);
      return;
    }
    if (paymentIntent?.status === "processing") {
      window.location.assign(`${RETURN_PATH}?redirect_status=succeeded`);
      return;
    }
    onError(
      "Your payment needs another step. Please try again or use a different card."
    );
    setBusy(false);
  }

  return (
    <>
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setReady(true)}
        onLoadError={(e) => {
          console.error(
            "[pay] Stripe card form failed to load:",
            e?.error || e
          );
          onError(
            "The payment form couldn't load for this fare. Go back to Seats and continue again, or search for a fresh fare."
          );
        }}
      />
      <button
        type="button"
        className="skc-btn-primary"
        style={{ marginTop: 16 }}
        onClick={pay}
        disabled={!stripe || !ready || busy || !exact}
      >
        {busy ? (
          <span className="skc-spinner" />
        ) : exact ? (
          `Pay ${fmt(shownAmount)}`
        ) : (
          "Loading price…"
        )}
      </button>
    </>
  );
}

export default function LiteApiPayForm({
  clientSecret,
  prebookId,
  transactionId,
  total,
  flight,
  passengers,
  groupId,
  progressKey,
  fareExpired,
  onBack,
  seats = [],
}) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loadingSdk, setLoadingSdk] = useState(false);
  // "sdk" = LiteAPI's form; "direct" = Stripe's form with LiteAPI's key
  const envKeyRaw = cleanKey(import.meta.env.VITE_LITEAPI_STRIPE_PK);
  // Only use a key if it belongs to this payment's Stripe account.
  const frag = accountFragment(clientSecret);
  const keyFits = (k) => Boolean(k && (!frag || k.includes(frag)));
  const envKey = keyFits(envKeyRaw) ? envKeyRaw : null;
  if (envKeyRaw && !envKey) {
    console.error(
      "[pay] VITE_LITEAPI_STRIPE_PK is from a different Stripe account than this payment",
      {
        paymentAccount: frag,
      }
    );
  }
  // "resolving" = asking the backend for the key before choosing a form
  const [mode, setMode] = useState(envKey ? "direct" : "resolving");
  const [directKey, setDirectKey] = useState(envKey);
  const targetRef = useRef(null);
  const lead = passengers?.[0] || {};
  const [exactTotal, setExactTotal] = useState(null); // { amount, currency }

  // Read once: the page's font + the stylesheets that load it.
  // Plain system stack only — custom page fonts can stop Stripe loading.
  const fontFamily = SANS_FALLBACK;
  const stripeAppearance = useMemo(
    () => buildStripeAppearance(fontFamily),
    [fontFamily]
  );

  // Keep the saved checkout (used by the confirmation page, email and
  // booking record) on the EXACT charged amount, not the estimate.
  const handleExactAmount = (amount, currency) => {
    setExactTotal({ amount, currency });
    try {
      const raw = window.sessionStorage.getItem(PENDING_FLIGHT_PAYMENT_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw);
      pending.total = amount;
      pending.currency = currency;
      if (pending.confirmationEmail) {
        pending.confirmationEmail.totalAmount = amount;
        pending.confirmationEmail.currency = currency;
      }
      window.sessionStorage.setItem(
        PENDING_FLIGHT_PAYMENT_KEY,
        JSON.stringify(pending)
      );
    } catch {
      /* non-fatal */
    }
  };
  const priceChanged =
    exactTotal &&
    Math.abs(Number(exactTotal.amount) - Number(total || 0)) >= 0.01;

  const ready =
    agreed && clientSecret && !fareExpired && prebookId && transactionId;

  // Save everything the return page needs (the SDK redirect reloads the app).
  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(
        PENDING_FLIGHT_PAYMENT_KEY,
        JSON.stringify({
          prebookId,
          transactionId,
          total,
          currency: flight?.currency || "USD",
          groupId: groupId || null,
          progressKey: progressKey || null,
          summary: {
            outbound: flight?.outbound
              ? `${flight.outbound.from} → ${flight.outbound.to} · ${flight.outbound.date}`
              : "",
            return:
              flight?.return && flight.return.date !== "Return TBD"
                ? `${flight.return.from} → ${flight.return.to} · ${flight.return.date}`
                : "",
          },
          confirmationEmail: {
            to: lead.email,
            passengerName: fullName(lead) || lead.firstName,
            airline: flight?.outbound?.airline,
            origin: flight?.raw?.origin || flight?.outbound?.from,
            destination: flight?.raw?.destination || flight?.outbound?.to,
            originName: flight?.raw?.slices?.[0]?.originName,
            destinationName: flight?.raw?.slices?.[0]?.destinationName,
            departureAt: flight?.raw?.departingAt,
            arrivalAt: flight?.raw?.arrivingAt,
            returnDepartureAt: flight?.raw?.returningAt || null,
            returnArrivingAt: flight?.raw?.returnArrivingAt || null,
            totalAmount: total,
            currency: flight?.currency,
            // Seats chosen in Skyrio — saved on the booking so friends on
            // the same flight can see them and sit nearby.
            seats: Array.isArray(seats) ? seats.slice(0, 40) : [],
          },
          savedAt: Date.now(),
        })
      );
    } catch {
      setError(
        "Your browser blocked checkout storage (private mode?). Try a normal window."
      );
    }
  }, [ready, prebookId, transactionId, total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Missing references → explain instead of failing silently.
  useEffect(() => {
    if (agreed && clientSecret && (!prebookId || !transactionId)) {
      setError(
        "Your fare reservation is missing a reference. Go back one step and try again."
      );
    }
  }, [agreed, clientSecret, prebookId, transactionId]);

  // No key in the build → get it from the backend (Render env).
  useEffect(() => {
    if (mode !== "resolving" || !clientSecret) return;
    let cancelled = false;
    fetchPaymentConfig()
      .then(({ stripePk }) => {
        if (cancelled) return;
        const key = cleanKey(stripePk);
        if (keyFits(key)) {
          console.info("[pay] using payment key from server");
          setDirectKey(key);
          setMode("direct");
        } else {
          if (key) {
            console.error(
              "[pay] server key is from a different Stripe account than this payment",
              {
                paymentAccount: frag,
              }
            );
          }
          setMode("sdk");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("[pay] couldn't get payment key from server:", e?.message);
        setMode("sdk");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  // LiteAPI SDK path, with automatic fallback to direct Stripe.
  useEffect(() => {
    if (!ready || mode !== "sdk") {
      if (targetRef.current && mode === "sdk") targetRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;
    let watchdog;
    setError("");
    setLoadingSdk(true);
    console.info("[pay] loading LiteAPI form", {
      env: import.meta.env.VITE_LITEAPI_ENV || "sandbox (default)",
      payment: piOf(clientSecret),
      transactionId: String(transactionId).slice(0, 14) + "…",
    });

    loadSdk()
      .then(async () => {
        if (cancelled || !targetRef.current) return;
        targetRef.current.innerHTML = "";
        try {
          const payment = new window.LiteAPIPayment({
            publicKey: import.meta.env.VITE_LITEAPI_ENV || "sandbox",
            appearance: { theme: "night" },
            options: { business: { name: "Skyrio" } },
            targetElement: `#${TARGET_ID}`,
            secretKey: clientSecret,
            returnUrl: `${window.location.origin}${RETURN_PATH}`,
          });
          await payment.handlePayment();
        } catch (e) {
          console.error("[pay] LiteAPI form threw:", e);
        }

        watchdog = setTimeout(() => {
          const box = targetRef.current;
          if (cancelled || !box || box.querySelector("iframe")) return;

          const pk = findPublishableKeyFromNetwork(clientSecret);
          console.warn("[pay] LiteAPI form rendered nothing", {
            payment: piOf(clientSecret),
            paymentAccount: accountFragment(clientSecret),
            matchingPublishableKey: pk ? pk.slice(0, 20) + "…" : null,
          });
          if (pk) {
            box.innerHTML = "";
            setDirectKey(pk);
            setMode("direct");
          } else {
            setError(
              "The payment form didn't load. Go back to Seats and continue again, or search for a fresh fare."
            );
          }
        }, SDK_TIMEOUT_MS);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingSdk(false));

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, [ready, mode, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  const stripePromise = useMemo(
    () => (mode === "direct" && directKey ? getStripe(directKey) : null),
    [mode, directKey]
  );

  useEffect(() => {
    if (mode === "direct" && directKey && ready) {
      console.info("[pay] direct Stripe form", {
        key: directKey.slice(0, 20) + "…",
        payment: piOf(clientSecret),
      });
    }
  }, [mode, directKey, ready, clientSecret]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAgreed((v) => !v)}
        role="checkbox"
        aria-checked={agreed}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${agreed ? "#f97316" : "rgba(255,255,255,0.10)"}`,
          background: agreed
            ? "rgba(249,115,22,.08)"
            : "rgba(255,255,255,0.04)",
          cursor: "pointer",
          marginBottom: 20,
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 14,
          minHeight: 52,
          touchAction: "manipulation",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${
              agreed ? "#f97316" : "rgba(255,255,255,0.42)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: agreed ? "#f97316" : "transparent",
            flexShrink: 0,
          }}
        >
          {agreed && <Check size={11} strokeWidth={3} />}
        </div>
        <span>
          I agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            fare rules
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            privacy policy
          </a>
          .
        </span>
      </button>

      <section style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.42)",
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          Payment
        </div>

        {!agreed && (
          <div
            style={{
              padding: "18px 16px",
              borderRadius: 14,
              border: "1px dashed rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.62)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Agree to the fare rules above to enter your card.
          </div>
        )}

        {agreed && ((mode === "sdk" && loadingSdk) || mode === "resolving") && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "rgba(255,255,255,0.62)",
              fontSize: 13,
            }}
          >
            <span className="skc-spinner" />{" "}
            <span style={{ marginLeft: 8 }}>Loading secure payment…</span>
          </div>
        )}

        {/* LiteAPI SDK mounts in here */}
        <div
          id={TARGET_ID}
          ref={targetRef}
          style={{
            display: agreed && mode === "sdk" ? "block" : "none",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: agreed && mode === "sdk" ? "20px 16px" : 0,
          }}
        />

        {ready && mode === "direct" && exactTotal && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: priceChanged
                ? "rgba(249,115,22,.08)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${
                priceChanged ? "rgba(249,115,22,.35)" : "rgba(255,255,255,0.10)"
              }`,
              fontSize: 13,
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#fff" }}>
              Total charged:{" "}
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: exactTotal.currency || "USD",
              }).format(exactTotal.amount)}
            </strong>
            {priceChanged ? (
              <div style={{ marginTop: 4 }}>
                This is the airline's final price for your fare and seats. It's
                different from the estimate shown above (
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: exactTotal.currency || "USD",
                }).format(Number(total || 0))}
                ) because the airline confirms prices at booking.
              </div>
            ) : (
              <div style={{ marginTop: 4 }}>
                Fare and selected seats, including taxes and fees.
              </div>
            )}
          </div>
        )}

        {/* Direct Stripe form */}
        {ready && mode === "direct" && stripePromise && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: "20px 16px",
            }}
          >
            <Elements
              key={`${directKey}:${clientSecret}`}
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <DirectStripeForm
                clientSecret={clientSecret}
                total={total}
                email={lead.email}
                onError={setError}
                onAmount={handleExactAmount}
              />
            </Elements>
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          style={{
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.3)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#f87171",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="skc-btn-row">
        <button type="button" className="skc-btn-back" onClick={onBack}>
          ← Back
        </button>
      </div>
    </>
  );
}
