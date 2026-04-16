import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuthModal() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used inside AuthProvider");
  }

  return {
    authModalOpen: ctx.authModalOpen,
    authModalMode: ctx.authModalMode,
    openAuthModal: ctx.openAuthModal,
    closeAuthModal: ctx.closeAuthModal,
    setAuthModalMode: ctx.setAuthModalMode,
  };
}