// ─────────────────────────────────────────────────────────────
// PolicyNote — makes it clear that refunds, cancellations, bags and
// changes are set by the AIRLINE or HOTEL, not by Skyrio.
//
// Skyrio shows exactly what the airline/hotel sends for that fare or rate;
// their rules are the ones that apply. Used in flight checkout, hotel
// checkout and on hotel results.
//
//   <PolicyNote kind="flight" provider="Delta Air Lines" />
//   <PolicyNote kind="hotel" provider="Hilton Miami" />
//   <PolicyNote kind="flight" provider="Delta" variant="agree" />   (by Pay)
// ─────────────────────────────────────────────────────────────
import React from "react";
import { ShieldAlert } from "lucide-react";

const CSS = `
.sk-pn { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px;
  background: rgba(124,92,252,.14); border: 1px solid rgba(167,139,250,.4);
  font-size: 12.5px; line-height: 1.55; color: rgba(255,255,255,.86); text-align: left; }
.sk-pn svg { flex-shrink: 0; margin-top: 2px; color: #c4b5fd; }
.sk-pn b { color: #fff; }
.sk-pn--agree { background: transparent; border: 0; padding: 0; font-size: 12px; color: rgba(255,255,255,.7); }
.sk-pn--agree svg { display: none; }
`;

const name = (provider, fallback) => {
  const p = String(provider || "").trim();
  return p && p !== "Unknown" ? p : fallback;
};

export default function PolicyNote({
  kind = "flight", // "flight" | "hotel"
  provider = "",
  variant = "box", // "box" | "agree"
  style,
}) {
  const isHotel = kind === "hotel";
  const who = name(provider, isHotel ? "the hotel" : "the airline");

  let body;
  if (variant === "agree") {
    body = isHotel ? (
      <>
        By paying, you agree to {who}&rsquo;s cancellation and refund policy for
        this rate. Skyrio can&rsquo;t change it.
      </>
    ) : (
      <>
        By paying, you agree to {who}&rsquo;s fare rules for bags, changes and
        refunds. Skyrio can&rsquo;t change them.
      </>
    );
  } else {
    body = isHotel ? (
      <>
        <b>Set by {who}, not Skyrio.</b> Refunds and cancellation terms come
        from {who} for this exact rate. We show what they send us, and their
        policy is final.
      </>
    ) : (
      <>
        <b>Set by {who}, not Skyrio.</b> Carry-on and checked bags, seat rules,
        changes and refunds come from {who} for this exact fare. We show what
        they send us, and their rules are final.
      </>
    );
  }

  return (
    <div
      className={`sk-pn${variant === "agree" ? " sk-pn--agree" : ""}`}
      role="note"
      style={style}
    >
      <style>{CSS}</style>
      <ShieldAlert size={15} aria-hidden="true" />
      <span>{body}</span>
    </div>
  );
}
