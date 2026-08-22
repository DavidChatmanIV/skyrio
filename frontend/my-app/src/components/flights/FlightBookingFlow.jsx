import { useState } from "react";
import SkyrioSeatMap from "./SkyrioSeatMap";
// TODO(api): import your real API helper
// import { apiUrl } from "@/lib/api";

/**
 * FlightBookingFlow
 * ------------------------------------------------------------------
 * Owns the 4-step LiteAPI flight flow:
 *   1. verify   -> confirm offer is still valid/priced
 *   2. prebook  -> lock the fare, get servicesAttachable (seats, bags, etc.)
 *   3. services -> optional add-ons — THIS is where SkyrioSeatMap mounts
 *   4. complete -> attach chosen services, then confirm/pay the booking
 *
 * This file is the state owner. SkyrioSeatMap stays presentational —
 * it never calls the API itself, it just reports selections up via
 * onSelectSeat.
 * ------------------------------------------------------------------
 */

const STEPS = ["verify", "prebook", "services", "complete"];

export default function FlightBookingFlow({
  offerId,
  passengers: initialPassengers,
}) {
  const [step, setStep] = useState("verify");
  const [prebookResponse, setPrebookResponse] = useState(null);
  const [prebookId, setPrebookId] = useState(null);
  const [passengers, setPassengers] = useState(initialPassengers ?? []);
  const [selectedSeats, setSelectedSeats] = useState({}); // { [passengerIndex]: { seatNumber, serviceId } }
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [knownOccupancy, setKnownOccupancy] = useState({}); // Tier 2 — optional, fill in once you have the shared collection
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- Step 1: verify -------------------------------------------------
  async function handleVerify() {
    setIsLoading(true);
    setError(null);
    try {
      // TODO(api): POST /v1/flights/offers/:offerId/verify
      // const res = await fetch(apiUrl(`/flights/offers/${offerId}/verify`), { method: "POST" });
      // if (!res.ok) throw new Error("Offer could not be verified");
      setStep("prebook");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Step 2: prebook --------------------------------------------------
  async function handlePrebook() {
    setIsLoading(true);
    setError(null);
    try {
      // TODO(api): POST /v1/flights/offers/:offerId/prebook
      // const res = await fetch(apiUrl(`/flights/offers/${offerId}/prebook`), {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ passengers }),
      // });
      // const data = await res.json();
      // setPrebookResponse(data);
      // setPrebookId(data.prebookId);

      // TODO(api): once you have the shared occupancy collection, fetch it here:
      // const occRes = await fetch(apiUrl(`/flights/seat-occupancy?flightKey=${data.flightKey}`));
      // setKnownOccupancy(await occRes.json());

      setStep("services");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Step 3: services (seat map lives here) ----------------------------
  function handleSelectSeat(passengerIndex, seatNumber, serviceId) {
    setSelectedSeats((prev) => ({
      ...prev,
      [passengerIndex]: { seatNumber, serviceId },
    }));
    // auto-advance to the next passenger who hasn't picked a seat yet
    const nextIndex = passengers.findIndex(
      (p, i) => i > passengerIndex && !selectedSeats[i]
    );
    if (nextIndex !== -1) setActivePassengerIndex(nextIndex);
  }

  async function handleConfirmServices() {
    setIsLoading(true);
    setError(null);
    try {
      const serviceSelections = Object.entries(selectedSeats).map(
        ([passengerIndex, sel]) => ({
          passengerIndex: Number(passengerIndex),
          serviceId: sel.serviceId,
        })
      );
      // TODO(api): POST /v1/flights/prebooks/:prebookId/services
      // await fetch(apiUrl(`/flights/prebooks/${prebookId}/services`), {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ services: serviceSelections }),
      // });

      // TODO(api): write to your own shared occupancy collection so
      // future Skyrio bookers on this same flight can see these seats:
      // await fetch(apiUrl("/flights/seat-occupancy"), {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     flightKey: prebookResponse.flightKey,
      //     seats: Object.values(selectedSeats).map((s, i) => ({
      //       seatNumber: s.seatNumber,
      //       type: passengers[i]?.type,
      //       hasPet: passengers[i]?.hasPet ?? false,
      //     })),
      //   }),
      // });

      setStep("complete");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Step 4: complete ---------------------------------------------------
  async function handleCompleteBooking() {
    setIsLoading(true);
    setError(null);
    try {
      // TODO(api): POST /v1/flights/prebooks/:prebookId/complete
      // await fetch(apiUrl(`/flights/prebooks/${prebookId}/complete`), { method: "POST" });
      // navigate to confirmation page
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const seatServices =
    prebookResponse?.servicesAttachable?.groups
      ?.flatMap((g) => g.services)
      ?.filter((s) => s.category === "seat") ?? [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <StepIndicator current={step} />

      {error && (
        <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {step === "verify" && (
        <StepPanel title="Confirming your fare">
          <button onClick={handleVerify} disabled={isLoading}>
            {isLoading ? "Verifying…" : "Verify offer"}
          </button>
        </StepPanel>
      )}

      {step === "prebook" && (
        <StepPanel title="Locking in your price">
          <button onClick={handlePrebook} disabled={isLoading}>
            {isLoading ? "Locking price…" : "Continue to seats & extras"}
          </button>
        </StepPanel>
      )}

      {step === "services" && (
        <>
          <SkyrioSeatMap
            passengers={passengers}
            seatServices={seatServices}
            selectedSeats={selectedSeats}
            knownOccupancy={knownOccupancy}
            activePassengerIndex={activePassengerIndex}
            onSelectSeat={handleSelectSeat}
          />
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button
              onClick={handleConfirmServices}
              disabled={
                isLoading ||
                Object.keys(selectedSeats).length < passengers.length
              }
            >
              {isLoading ? "Saving seats…" : "Continue to review"}
            </button>
          </div>
        </>
      )}

      {step === "complete" && (
        <StepPanel title="Review & confirm">
          <button onClick={handleCompleteBooking} disabled={isLoading}>
            {isLoading ? "Booking…" : "Confirm booking"}
          </button>
        </StepPanel>
      )}
    </div>
  );
}

function StepIndicator({ current }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "center",
        margin: "20px 0",
      }}
    >
      {STEPS.map((s) => (
        <span
          key={s}
          style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 999,
            background: s === current ? "#FF7A3D" : "rgba(255,255,255,0.08)",
            color: s === current ? "#111" : "#9A9AA5",
            fontWeight: 600,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function StepPanel({ title, children }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
