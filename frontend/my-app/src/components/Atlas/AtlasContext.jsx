import { createContext, useContext, useState, useCallback } from "react";

const AtlasContext = createContext(null);

export function AtlasProvider({ children }) {
  const [atlasDestination, setAtlasDestination] = useState(null);
  const [pendingAtlasMessage, setPendingAtlasMessage] = useState(null);

  const [atlasContext, setAtlasContext] = useState({
    destination: null,
    budget: null,
    tripDays: null,
    bookingTotal: null,
    spent: null,
    flights: [],
    tripType: null,
    // Sync Together trip the traveler is looking at. SyncGroupPage sets it
    // with updateAtlasContext({ syncTripId: trip._id }) and clears it with
    // updateAtlasContext({ syncTripId: null }) when the page closes, so
    // Atlas can book this traveler's share without asking which trip.
    syncTripId: null,
  });

  const updateAtlasContext = useCallback((patch) => {
    setAtlasContext((prev) => ({ ...prev, ...patch }));
    if (patch.destination) setAtlasDestination(patch.destination);
  }, []);

  const sendAtlasMessage = useCallback((message) => {
    setPendingAtlasMessage({ text: message, id: Date.now() });
  }, []);

  const clearPendingAtlasMessage = useCallback(() => {
    setPendingAtlasMessage(null);
  }, []);

  return (
    <AtlasContext.Provider
      value={{
        atlasDestination,
        setAtlasDestination,
        atlasContext,
        updateAtlasContext,
        pendingAtlasMessage,
        sendAtlasMessage,
        clearPendingAtlasMessage,
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
