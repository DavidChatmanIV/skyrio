import { useContext, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// Opens login/sign-up. There's no pop-up login wired into AuthProvider, so
// (unless one is added) this goes to the login or sign-up page and comes
// back to where the person was. Before, these were undefined, so "Save
// trip" and the members-only buttons silently did nothing for guests.
export function useAuthModal() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used inside AuthProvider");
  }
  const navigate = useNavigate();
  const location = useLocation();

  const goAuth = useCallback(
    (opts = {}, maybeIntent, maybeRedirect) => {
      // Called as ({ mode, intent, redirectTo }) or ("login", intent, redirectTo)
      const o = typeof opts === "string" ? { mode: opts, intent: maybeIntent, redirectTo: maybeRedirect } : opts || {};
      const here = `${location.pathname}${location.search}`;
      const mode = o.mode === "signup" || o.mode === "register" ? "signup" : "login";
      navigate(mode === "signup" ? "/register" : "/login", {
        state: { redirectTo: o.redirectTo || here, intent: o.intent || null },
      });
    },
    [navigate, location.pathname, location.search]
  );

  const open = ctx.openAuthModal || goAuth;
  return {
    authModalOpen: ctx.authModalOpen || false,
    authModalMode: ctx.authModalMode || "login",
    openAuthModal: open,
    openAuth: ctx.openAuth || open,
    closeAuthModal: ctx.closeAuthModal || (() => {}),
    setAuthModalMode: ctx.setAuthModalMode || (() => {}),
  };
}
