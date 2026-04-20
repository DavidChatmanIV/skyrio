/**
 * ─────────────────────────────────────────────────────────────
 * Global context so any page can feed Atlas real booking data:
 * destination, budget, flight results, and spend tracking.
 * ─────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useCallback } from "react";

const AtlasContext = createContext(null);

export function AtlasProvider({ children }) {
  const [atlasDestination, setAtlasDestination] = useState(null);

  // Full booking context passed into every Atlas request
  const [atlasContext, setAtlasContext] = useState({
    destination: null,
    budget: null,
    tripDays: null,
    bookingTotal: null,
    spent: null,
    flights: [],
  });

  // Convenience updater — merges partial updates so callers
  // only need to pass what changed
  const updateAtlasContext = useCallback((patch) => {
    setAtlasContext((prev) => ({ ...prev, ...patch }));
    // Keep destination in sync for the chat widget header
    if (patch.destination) setAtlasDestination(patch.destination);
  }, []);

  return (
    <AtlasContext.Provider
      value={{
        atlasDestination,
        setAtlasDestination,
        atlasContext,
        updateAtlasContext,
      }}
    >
      {children}
    </AtlasContext.Provider>
  );
}

export function useAtlasContext() {
  const ctx = useContext(AtlasContext);
  if (!ctx)
    throw new Error("useAtlasContext must be used inside AtlasProvider");
  return ctx;
}