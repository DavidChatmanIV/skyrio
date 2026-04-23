import { useCallback, useState } from "react";
import {
  makeMockFlights,
  normalizeAmadeusOffers,
} from "../utils/flightNormalize";
import { apiUrl } from "@/lib/api";

async function fetchAmadeusFlights(params) {
  const res = await fetch(apiUrl("/api/amadeus/flights"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Amadeus fetch failed: ${res.status}`);
  return res.json();
}

export function useFlightSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState("idle");
  const [error, setError] = useState(null);

  const search = useCallback(async (params) => {
    setError(null);
    setLoading(true);

    setResults(
      makeMockFlights({
        origin: params?.origin,
        destination: params?.destination,
      })
    );
    setMode("mock");

    try {
      const payload = await fetchAmadeusFlights(params);
      const live = normalizeAmadeusOffers(payload);
      if (live?.length) {
        setResults(live);
        setMode("live");
      } else {
        setMode("failed");
      }
    } catch (e) {
      setError(e?.message || "Flight search failed");
      setMode("failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, results, mode, error, search };
}
