import { useContext } from "react";
import { AuthContext } from "./AuthModalController";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useAuthModal() {
  const ctx = useAuth();
  return {
    openAuthModal: ctx.openAuthModal,
    closeAuthModal: ctx.closeAuthModal,
    authModalOpen: ctx.authModalOpen,
    authModalMode: ctx.authModalMode,
    setAuthModalMode: ctx.setAuthModalMode,
  };
}