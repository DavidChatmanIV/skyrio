import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";

// ✅ FIX: your AuthModal is in /src/auth/AuthModal.jsx (not /components)
import AuthModal from "@/auth/AuthModal";

import { useAuth } from "@/auth/useAuth";
import { trackSoftEvent } from "@/lib/softAnalytics";

/**
 * useRequireAuth
 * - Provides: requireAuth(intent, redirectTo)
 * - Provides: authModalNode to render once (in AppLayout or Navbar)
 * - Provides: openAuthModal(mode, intent, redirectTo) to open modal from Navbar buttons
 */
export default function useRequireAuth() {
  const nav = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  // ✅ more resilient authed detection (helps your navbar switch correctly)
  const isAuthed = !!auth?.isAuthed || (!!auth?.user && !auth?.isGuest);
  const isGuest = !!auth?.isGuest;

  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("continue");
  const [redirectTo, setRedirectTo] = useState("/passport");

  // ✅ added: lets modal open on the right tab
  const [defaultTab, setDefaultTab] = useState("login");

  const close = useCallback(() => setOpen(false), []);

  const requireAuth = useCallback(
    (nextIntent = "continue", nextRedirectTo) => {
      // If already authed, allow
      if (isAuthed && !isGuest) return true;

      const fallbackRedirect =
        nextRedirectTo || location?.pathname || "/passport";

      setIntent(nextIntent);
      setRedirectTo(fallbackRedirect);
      setDefaultTab("login"); // safe default
      setOpen(true);

      trackSoftEvent?.("auth_required", {
        intent: nextIntent,
        redirectTo: fallbackRedirect,
        from: location?.pathname,
      });

      return false;
    },
    [isAuthed, isGuest, location?.pathname]
  );

  const continueGuestAndGo = useCallback(
    (to = redirectTo) => {
      auth?.continueAsGuest?.();
      message.success("Guest mode enabled ✨");
      setOpen(false);
      if (to) nav(to, { state: { fromAuth: true } });
    },
    [auth, nav, redirectTo]
  );

  const openAuthModal = useCallback(
    (mode = "login", nextIntent = "continue", nextRedirectTo) => {
      const fallbackRedirect =
        nextRedirectTo || location?.pathname || "/passport";

      setIntent(nextIntent);
      setRedirectTo(fallbackRedirect);
      setDefaultTab(mode === "signup" ? "signup" : "login");
      setOpen(true);

      trackSoftEvent?.("auth_opened", {
        mode,
        intent: nextIntent,
        redirectTo: fallbackRedirect,
        from: location?.pathname,
      });
    },
    [location?.pathname]
  );

  // ✅ Render node (place once in Navbar or AppLayout)
  const authModalNode = useMemo(() => {
    return (
      <AuthModal
        open={open}
        onClose={close}
        intent={intent}
        redirectTo={redirectTo}
        defaultTab={defaultTab} 
      />
    );
  }, [open, close, intent, redirectTo, defaultTab]);

  return {
    requireAuth,
    authModalNode,
    openAuthModal,
    closeAuthModal: close,
    continueGuestAndGo,
  };
}
