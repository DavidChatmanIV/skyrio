//
// Loads the signed-in traveler's booked flight/stay and total spent for a
// Sync Together group from the server. Use this as the ONLY source for the
// trip card (tiles, "x of 2 booked", "Next:" button and budget bar).
//
// Refetches when the tab regains focus, so finishing a booking in another
// tab (or on another device) shows up without a manual refresh.

import { useCallback, useEffect, useRef, useState } from "react";

const API = import.meta.env?.VITE_API_URL || "";

export default function useTripProgress(groupId) {
  const [state, setState] = useState({
    loading: !!groupId,
    error: "",
    flight: null,
    stay: null,
    bookedCount: 0,
    requiredCount: 2,
    spent: 0,
  });
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    const reqId = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/sync-progress/${groupId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Could not load trip progress");
      }
      if (reqId !== reqIdRef.current) return; // a newer request won
      setState({
        loading: false,
        error: "",
        flight: data.flight,
        stay: data.stay,
        bookedCount: data.bookedCount,
        requiredCount: data.requiredCount,
        spent: data.spent,
      });
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [groupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { ...state, refresh };
}

// ── How the trip card uses it ──
//
//   import useTripProgress from "@/hooks/useTripProgress";
//
//   const { flight, stay, bookedCount, requiredCount, spent, loading } =
//     useTripProgress(groupId);
//
//   const flightBooked = !!flight;            // tile check mark
//   const stayBooked = !!stay;
//   const left = budget - spent;              // "$1,168 left of $1,500"
//   const nextStep = !flightBooked ? "flight" : !stayBooked ? "stay" : null;
//
//   <h2>{bookedCount} of {requiredCount} booked</h2>
//   {flight && <span>{flight.tripDetails} · ${flight.amount}</span>}
