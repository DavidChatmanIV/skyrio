// src/pages/booking/AtlasCheckoutPage.jsx
// Route: /checkout/atlas/:id  (opened from Atlas's "Review & pay" card)
//
// Loads the flight or room the traveler picked in Atlas, then shows the SAME
// checkout the Book page uses — BookingCheckout or HotelCheckout — so
// passengers, seats, Stripe, guest checkout and saved-traveler autofill all
// work exactly as usual. Works signed in or as a guest.
//
// Leaving this checkout goes back to ATLAS (not the Book page): people came
// from the chat, so that's where their other options are. If the flight
// sold out, Atlas is asked for the closest options right away.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BookingCheckout from "@/pages/booking/BookingCheckout";
import HotelCheckout from "@/pages/booking/HotelCheckout";
import "@/styles/atlas-checkout.css";

const API = import.meta.env.VITE_API_URL || "";
const BOOK_PATH = "/booking";
const CHAT_KEY = "skyrio_atlas_chat"; // same key AtlasPanel uses

function hasAtlasChat() {
  try {
    const list = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "[]");
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

function openAtlas(message) {
  window.dispatchEvent(
    new CustomEvent("skyrio:open-atlas", {
      detail: { mode: "chat", ...(message ? { message } : {}) },
    })
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3 2 20h20L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4M12 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Notice({ children, onAskAtlas }) {
  return (
    <div className="atlas-checkout-page">
      <div className="draft-banner draft-banner--warn" role="status">
        <AlertIcon />
        <span>{children}</span>
        <button
          type="button"
          className="draft-banner__btn"
          onClick={onAskAtlas}
        >
          Ask Atlas
        </button>
        <Link className="draft-banner__btn" to={BOOK_PATH}>
          Go to Book
        </Link>
      </div>
    </div>
  );
}

// "United · EWR → MIA · Thu, Dec 4"
function flightLabel(offer = {}) {
  const when = offer.departingAt
    ? new Date(offer.departingAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  return [
    offer.owner || offer.airline,
    offer.origin && offer.destination
      ? `${offer.origin} → ${offer.destination}`
      : "",
    when,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AtlasCheckoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetch(`${API}/api/atlas/handoffs/${encodeURIComponent(id || "")}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && body.ok && body.offer)
          setState({ status: "ready", data: body });
        else if (res.status === 410) setState({ status: "expired" });
        else setState({ status: "missing" });
      })
      .catch(() => alive && setState({ status: "network" }));
    return () => {
      alive = false;
    };
  }, [id]);

  // Back to wherever the traveler was chatting with Atlas (this tab's
  // previous page), or Discover if checkout opened in a new tab.
  const backToAtlas = (message) => {
    const canGoBack = (window.history.state?.idx ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate("/");
    // Let the page change, then open the chat (and ask, if needed).
    setTimeout(() => openAtlas(message), 400);
  };

  if (state.status === "loading") {
    return (
      <div className="atlas-checkout-page">
        <div className="draft-banner" role="status">
          <span>Loading your trip…</span>
        </div>
      </div>
    );
  }
  if (state.status === "expired") {
    return (
      <Notice
        onAskAtlas={() =>
          backToAtlas(
            "The price you found for me expired. Can you search again with the same details?"
          )
        }
      >
        This price expired. Atlas can search again for a fresh one.
      </Notice>
    );
  }
  if (state.status === "missing") {
    return (
      <Notice
        onAskAtlas={() =>
          backToAtlas(
            hasAtlasChat() ? undefined : "Can you help me find that trip again?"
          )
        }
      >
        This checkout link isn&apos;t valid anymore. Ask Atlas again or search
        on the Book page.
      </Notice>
    );
  }
  if (state.status === "network") {
    return (
      <Notice onAskAtlas={() => backToAtlas()}>
        Couldn&apos;t reach Skyrio. Check your connection and refresh this page.
      </Notice>
    );
  }

  const { kind, offer } = state.data;

  if (kind === "hotel") {
    const back = () =>
      backToAtlas(
        hasAtlasChat() ? undefined : "Show me the other hotel options again."
      );
    return (
      <HotelCheckout
        rooms={[offer]}
        onBack={back}
        onBookingComplete={() => navigate("/saved-trips")}
      />
    );
  }

  // BookingCheckout calls onBack({ unavailable: true }) when the fare sold out.
  const backFromFlight = (info) => {
    if (info?.unavailable) {
      const what = flightLabel(offer);
      backToAtlas(
        `The flight I picked${what ? ` (${what})` : ""} just sold out. ` +
          "Show me the closest options from the same search."
      );
      return;
    }
    backToAtlas(
      hasAtlasChat() ? undefined : "Show me the other flight options again."
    );
  };
  return <BookingCheckout flight={offer} onBack={backFromFlight} />;
}
