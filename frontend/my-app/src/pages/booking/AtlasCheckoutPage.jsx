// src/pages/booking/AtlasCheckoutPage.jsx
// Route: /checkout/atlas/:id  (opened from Atlas's "Review & pay" card)
//
// Loads the flight or room the traveler picked in Atlas, then shows the SAME
// checkout the Book page uses — BookingCheckout or HotelCheckout — so
// passengers, seats, Stripe, guest checkout and saved-traveler autofill all
// work exactly as usual. Works signed in or as a guest.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BookingCheckout from "@/pages/booking/BookingCheckout";
import HotelCheckout from "@/pages/booking/HotelCheckout";
import "@/styles/atlas-checkout.css";

const API = import.meta.env.VITE_API_URL || "";
// Where "Back" goes. Change if your Book page lives elsewhere.
const BOOK_PATH = "/booking";

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Notice({ children }) {
  return (
    <div className="atlas-checkout-page">
      <div className="draft-banner draft-banner--warn" role="status">
        <AlertIcon />
        <span>{children}</span>
        <Link className="draft-banner__btn" to={BOOK_PATH}>
          Go to Book
        </Link>
      </div>
    </div>
  );
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
        if (res.ok && body.ok && body.offer) setState({ status: "ready", data: body });
        else if (res.status === 410) setState({ status: "expired" });
        else setState({ status: "missing" });
      })
      .catch(() => alive && setState({ status: "network" }));
    return () => {
      alive = false;
    };
  }, [id]);

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
    return <Notice>This price expired. Ask Atlas to search again for a fresh one, or search on the Book page.</Notice>;
  }
  if (state.status === "missing") {
    return <Notice>This checkout link isn't valid anymore. Ask Atlas again or search on the Book page.</Notice>;
  }
  if (state.status === "network") {
    return <Notice>Couldn't reach Skyrio. Check your connection and refresh this page.</Notice>;
  }

  const { kind, offer } = state.data;
  const back = () => navigate(BOOK_PATH);

  if (kind === "hotel") {
    return <HotelCheckout rooms={[offer]} onBack={back} onBookingComplete={back} />;
  }
  return <BookingCheckout flight={offer} onBack={back} />;
}
