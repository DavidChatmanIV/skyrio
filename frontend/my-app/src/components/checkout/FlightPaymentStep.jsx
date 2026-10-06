// frontend/my-app/src/components/checkout/FlightPaymentStep.jsx
// Used inside BookingCheckout.jsx for flights, AFTER the passenger form is complete:
//   <FlightPaymentStep offerId={offerId} contact={contact} passengers={passengers}
//     renderSeatMap={({ servicesAttachable, attachServices, updating }) => <YourSeatMap ... />} />
// Env: VITE_LITEAPI_ENV = "sandbox" | "live" (must match the backend LITEAPI_KEY environment)
//
// Pass contact/passengers from useMemo or state — a new object every render re-runs prebook.

import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";

const SDK_SRC =
  "https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1";
const TARGET_ID = "skyrio-flight-payment";

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
          new Error("Payment form failed to load. Refresh and try again.")
        ),
      { once: true }
    );
    if (window.LiteAPIPayment) resolve(); // loaded between the check and the listener
  });
}

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export default function FlightPaymentStep({
  offerId,
  contact,
  passengers,
  renderSeatMap,
}) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const targetRef = useRef(null);

  // 1) Prebook
  useEffect(() => {
    if (!offerId || !contact || !passengers?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/flight-payments/prebook"), {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({ offerId, contact, passengers }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't hold this fare.");
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId, contact, passengers]);

  // 2) Mount / re-mount the payment form when the secretKey changes
  useEffect(() => {
    if (!session?.secretKey) return;
    let cancelled = false;
    loadSdk()
      .then(() => {
        if (cancelled || !targetRef.current) return;
        targetRef.current.innerHTML = "";
        const payment = new window.LiteAPIPayment({
          publicKey: import.meta.env.VITE_LITEAPI_ENV || "sandbox",
          appearance: { theme: "night" },
          options: { business: { name: "Skyrio" } },
          targetElement: `#${TARGET_ID}`,
          secretKey: session.secretKey,
          returnUrl: `${window.location.origin}/checkout/flight/complete?sid=${session.sessionId}`,
        });
        payment.handlePayment();
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [session?.secretKey, session?.sessionId]);

  // 3) Seat map calls this with [{ passengerIndex, serviceId, quantity }]
  const attachServices = useCallback(
    async (selectedServices) => {
      if (!session?.sessionId) return;
      setUpdating(true);
      setError("");
      try {
        const res = await fetch(
          apiUrl(`/api/flight-payments/${session.sessionId}/services`),
          {
            method: "POST",
            headers: authHeaders(),
            credentials: "include",
            body: JSON.stringify({ selectedServices }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't save your seats.");
        setSession((s) => ({ ...s, ...data }));
      } catch (e) {
        setError(e.message);
      } finally {
        setUpdating(false);
      }
    },
    [session?.sessionId]
  );

  if (error && !session)
    return (
      <p role="alert" style={{ color: "#ff6b6b" }}>
        {error}
      </p>
    );
  if (!session) return <p>Holding your fare…</p>;

  const price = session.total
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: session.currency || "USD",
      }).format(session.total)
    : null;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {renderSeatMap?.({
        servicesAttachable: session.servicesAttachable,
        attachServices,
        updating,
      })}
      {price && (
        <p style={{ margin: 0 }}>
          Total: <strong>{price}</strong>
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "#ff6b6b", margin: 0 }}>
          {error}
        </p>
      )}
      <div
        id={TARGET_ID}
        ref={targetRef}
        style={{
          opacity: updating ? 0.4 : 1,
          pointerEvents: updating ? "none" : "auto",
        }}
      />
    </div>
  );
}
