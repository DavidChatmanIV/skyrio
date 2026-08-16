import { useCallback, useState } from "react";
import { apiUrl } from "@/lib/api";

// ─────────────────────────────────────────────────────────────
// useExcursionSearch
// Mirrors useFlightSearch.js — no mock fallback since excursions
// are display-only (no booking flow on Skyrio's side), so a
// failed live call should just surface as an empty/error state
// rather than fabricated mock data.
// ─────────────────────────────────────────────────────────────

async function fetchDestinationId(name) {
  const res = await fetch(
    apiUrl(`/api/excursions/destinations?name=${encodeURIComponent(name)}`)
  );
  if (!res.ok) throw new Error(`Destination lookup failed: ${res.status}`);
  const json = await res.json();
  return json?.destinations?.[0]?.destinationId ?? null;
}

async function fetchExcursions(params) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  ).toString();
  const res = await fetch(apiUrl(`/api/excursions/search?${query}`));
  if (!res.ok) throw new Error(`Excursion search failed: ${res.status}`);
  return res.json();
}

export function useExcursionSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // params: { destination (place name), startDate, endDate, category,
  //           minPrice, maxPrice, sort, page }
  const search = useCallback(async (params) => {
    setError(null);
    setLoading(true);

    try {
      const destinationId =
        params.destinationId ||
        (params.destination
          ? await fetchDestinationId(params.destination)
          : null);

      if (!destinationId) {
        setResults([]);
        setError("Couldn't find that destination — try a different name.");
        return;
      }

      const payload = await fetchExcursions({
        destinationId,
        startDate: params.startDate,
        endDate: params.endDate,
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        sort: params.sort,
        page: params.page || 1,
      });

      setResults(payload?.excursions ?? []);
    } catch (e) {
      setError(e?.message || "Excursion search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, results, error, search };
}
