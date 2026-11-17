// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";

import { Plane as PlaneIcon, MapPin, Calendar } from "lucide-react";
import { ATLAS_LOADING_STEPS } from "./flightUtils";

// ─────────────────────────────────────────────
// Skyrio Logo Loading State
// ─────────────────────────────────────────────
export function FlightSkeleton({ destCity, fromCode }) {
  const [stepIdx, setStepIdx] = useState(0);
  // Seconds since this search started — drives the honest "still
  // searching" messages below so a slow airline response never looks frozen.
  const [waitedSec, setWaitedSec] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const t = setInterval(
      () => setWaitedSec(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, []);
  const providers = fromCode ? "Airlines" : "Hotels";
  const waitMessage =
    waitedSec >= 50
      ? `Taking longer than usual — we're checking with the ${
          fromCode ? "airline" : "hotels"
        } again…`
      : waitedSec >= 20
      ? `Still searching. ${providers} can be slow.`
      : "Live prices can take up to a minute.";
  useEffect(() => {
    const iv = setInterval(
      () => setStepIdx((i) => (i + 1) % ATLAS_LOADING_STEPS.length),
      1800
    );
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="sk-search-loading">
      <div className="sk-search-loading__logo-wrap">
        <div className="sk-search-loading__glow" />
        <div className="sk-search-loading__ring" />
        <div className="sk-search-loading__ring-2" />
        <img
          src={skyrioLogo}
          alt="Skyrio"
          className="sk-search-loading__logo"
        />
      </div>
      <div className="sk-search-loading__label">Skyrio AI active</div>
      <div className="sk-search-loading__copy">
        {ATLAS_LOADING_STEPS[stepIdx]}
      </div>
      <div className="sk-search-loading__sub">
        {fromCode && destCity
          ? `Comparing ${fromCode} → ${destCity}…`
          : "Finding the best flights for your trip."}
      </div>
      <div className="sk-search-loading__sub" role="status" aria-live="polite">
        {waitMessage}
      </div>
      <div className="sk-search-loading__bar">
        <div className="sk-search-loading__bar-fill" />
      </div>
      <div className="sk-flight-skeleton">
        {[1, 2, 3].map((i) => (
          <div key={i} className="sk-skeleton-card">
            <div className="sk-skeleton-thumb sk-shimmer" />
            <div className="sk-skeleton-body">
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "52%" }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "38%", marginTop: 8 }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "28%", marginTop: 8 }}
              />
            </div>
            <div className="sk-skeleton-price sk-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Multiple rooms — how it works
// Rooms go into "your trip" (the room cart). Picking the same room again
// adds another of it. A bar pinned to the bottom of the screen always
// shows what's in the trip and checks out every room together.
// ─────────────────────────────────────────────

// Set VITE_FLIGHTS_TEST_MODE=true on Vercel while using LiteAPI's sandbox:
// its test fares often "sell out" seconds after a search.
export const FLIGHTS_TEST_MODE =
  String(import.meta.env.VITE_FLIGHTS_TEST_MODE || "").toLowerCase() === "true";

export function UnavailableNotice({ notice, groupId, onClose, onTryAlternative }) {
  const primaryRef = useRef(null);
  useEffect(() => {
    if (!notice) return;
    primaryRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notice, onClose]);
  if (!notice) return null;

  const icon =
    notice.kind === "flight" ? (
      <PlaneIcon size={28} />
    ) : notice.kind === "hotel" ? (
      <MapPin size={28} />
    ) : (
      <Calendar size={28} />
    );
  const seeOthers =
    notice.kind === "flight"
      ? "See other flights"
      : notice.kind === "hotel"
      ? "See other rooms"
      : "See other activities";

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sk-unavailable-title"
      aria-describedby="sk-unavailable-desc"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000000,
        background: "rgba(8,6,18,0.82)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#150f28",
          border: "1px solid rgba(248,113,113,.35)",
          borderRadius: 20,
          padding: "28px 24px 24px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "rgba(248,113,113,.12)",
            border: "1px solid rgba(248,113,113,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f87171",
          }}
        >
          {icon}
        </div>
        <div
          id="sk-unavailable-title"
          style={{ fontWeight: 800, fontSize: 21, marginBottom: 8 }}
        >
          {notice.title}
        </div>
        {(notice.item || notice.when) && (
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {notice.item}
            {notice.item && notice.when ? " · " : ""}
            {notice.when}
          </div>
        )}
        <div
          id="sk-unavailable-desc"
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.62)",
            lineHeight: 1.55,
            marginBottom: notice.removed ? 12 : 22,
          }}
        >
          {notice.body}
          {notice.kind === "flight" && FLIGHTS_TEST_MODE && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#fbbf24" }}>
              Test mode: our airline test system often marks fares sold out
              right after a search. Real fares at launch won't do this.
            </div>
          )}
        </div>
        {notice.alternative && onTryAlternative && (
          <div
            style={{
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(52,211,153,.35)",
              background: "rgba(52,211,153,.07)",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#34d399",
                marginBottom: 4,
              }}
            >
              Closest flight still available
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>
              {notice.alternative.label}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
              {notice.alternative.detail}
            </div>
          </div>
        )}
        {notice.alternative && onTryAlternative && (
          <button
            type="button"
            onClick={() => onTryAlternative(notice.alternative.flight)}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Book this flight instead
          </button>
        )}
        {notice.removed && (
          <div
            role="status"
            style={{
              fontSize: 13,
              color: "#34d399",
              background: "rgba(52,211,153,.08)",
              border: "1px solid rgba(52,211,153,.25)",
              borderRadius: 10,
              padding: "8px 12px",
              marginBottom: 22,
            }}
          >
            Removed from your group's list, so nobody else picks it.
          </div>
        )}
        <button
          ref={primaryRef}
          type="button"
          onClick={onClose}
          style={
            notice.alternative && onTryAlternative
              ? {
                  width: "100%",
                  padding: 13,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  marginBottom: groupId ? 10 : 0,
                }
              : {
                  width: "100%",
                  padding: 15,
                  borderRadius: 14,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  marginBottom: groupId ? 10 : 0,
                }
          }
        >
          {notice.alternative && onTryAlternative
            ? "See all other flights"
            : seeOthers}
        </button>
        {groupId && (
          <Link
            to={`/sync-together/${groupId}`}
            style={{
              display: "block",
              padding: 13,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to the trip
          </Link>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── "Today's price" (opened from My Trips) ──────────────────────────
   You paid X · today the same trip is from Y. Compares like with like:
   the same airline (or the same hotel) when it's in the results, and says
   so plainly when it isn't. Prices are live search results, not a quote. */
export function PriceCheckBanner({ check, tab, flights, hotels }) {
  const money = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: check.cur || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  const minOf = (list) => {
    const nums = list
      .map((x) => Number(x.totalAmount))
      .filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? Math.min(...nums) : null;
  };
  const same = (a, b) =>
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase();

  let label = "";
  let now = null;
  let other = null;
  if (tab === "Flights") {
    const mine = check.airline
      ? flights.filter((f) => same(f.owner, check.airline))
      : [];
    now = minOf(mine.length ? mine : flights);
    label = mine.length ? `${check.airline} today` : "Today, any airline";
    if (mine.length) {
      const any = minOf(flights);
      if (any && now && any < now)
        other = `Cheapest on any airline: ${money(any)}`;
    } else if (check.airline && flights.length) {
      other = `${check.airline} isn't in today's results.`;
    }
  } else {
    const mine = check.hotelName
      ? hotels.filter((h) => same(h.name, check.hotelName))
      : [];
    now = minOf(mine.length ? mine : hotels);
    label = mine.length ? `${check.hotelName} today` : "Today, this area";
    if (!mine.length && check.hotelName && hotels.length)
      other = `${check.hotelName} isn't in today's results.`;
  }
  if (now == null) return null;

  const diff = Math.round(now - check.paid);
  const tone = diff < 0 ? "#6ee7a8" : diff > 0 ? "#ffb347" : "#fff";
  const bookedOn = check.bookedOn
    ? new Date(`${check.bookedOn}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  return (
    <div
      role="status"
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background:
          "linear-gradient(160deg, rgba(74,40,112,0.62), rgba(34,18,62,0.74))",
        border: "1px solid rgba(255,179,71,0.45)",
        color: "#fff",
        fontSize: 13.5,
        lineHeight: 1.5,
        maxWidth: 620,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 18px",
          alignItems: "baseline",
        }}
      >
        <span>
          You paid <b>{money(check.paid)}</b>
          {bookedOn ? ` on ${bookedOn}` : ""}
        </span>
        <span>
          {label} from <b>{money(now)}</b>
        </span>
        <b style={{ color: tone }}>
          {diff < 0
            ? `${money(-diff)} less now`
            : diff > 0
            ? `${money(diff)} more now`
            : "Same price"}
        </b>
      </div>
      <div
        style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.65)" }}
      >
        {[
          check.newDates ? "Same trip length, new dates." : "Same dates.",
          other,
          "Live prices. Your booking isn't changed.",
        ]
          .filter(Boolean)
          .join(" ")}
      </div>
    </div>
  );
}

/* ── Last search, kept for this tab ─────────────────────────────────
   If the traveler leaves Book (swipes back to Home) and comes back, their
   last flight or stay search is still there: the search fields filled in
   and, while prices are still valid, the results too.
   • Flights: only fares that haven't expired (each has expiresAt, about
     10 minutes). If none are left, just the search fields come back.
   • Stays: results for 20 minutes (room prices are re-checked before
     anyone pays anyway).
   sessionStorage = this browser tab only; gone when the tab closes. */
