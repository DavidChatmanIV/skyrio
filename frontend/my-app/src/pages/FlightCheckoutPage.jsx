import { useLocation, useParams } from "react-router-dom";
import FlightBookingFlow from "../components/flights/FlightBookingFlow";

/**
 * FlightCheckoutPage
 * ------------------------------------------------------------------
 * The page a user lands on right after selecting a flight from
 * search results. Its only job is to pull the offerId and passenger
 * list from wherever your search flow hands them off, then mount
 * FlightBookingFlow, which owns the actual 4-step LiteAPI process.
 *
 * ASSUMPTION: this uses react-router-dom, since that's the standard
 * for a Vite/React app — adjust the two lines below if you're on a
 * different router or pass this data another way (e.g. Zustand,
 * context, or query params instead of location.state).
 * ------------------------------------------------------------------
 */

export default function FlightCheckoutPage() {
  // TODO(api): adjust to however your flight search results page
  // navigates here. Common patterns:
  //   navigate(`/flights/checkout/${offer.id}`, { state: { offer, passengers } })
  const { offerId } = useParams();
  const location = useLocation();
  const { offer, passengers } = location.state ?? {};

  if (!offerId || !passengers) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9A9AA5" }}>
        <p>We couldn't find that flight offer.</p>
        <p style={{ fontSize: 13 }}>
          Go back to search and select a flight to continue.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100vh", background: "#0b0d12", padding: "24px 0" }}
    >
      <FlightBookingFlow offerId={offerId} passengers={passengers} />
    </div>
  );
}
