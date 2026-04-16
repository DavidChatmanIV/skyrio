/**
 * AtlasContext.js
 * ─────────────────────────────────────────────────────────────
 * Global context so any page can tell Atlas the current
 * destination without prop drilling.
 * ─────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState } from "react";

const AtlasContext = createContext(null);

export function AtlasProvider({ children }) {
  const [atlasDestination, setAtlasDestination] = useState(null);

  return (
    <AtlasContext.Provider value={{ atlasDestination, setAtlasDestination }}>
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