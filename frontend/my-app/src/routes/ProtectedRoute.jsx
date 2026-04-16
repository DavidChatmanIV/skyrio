import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/**
 * ProtectedRoute
 *
 * Wraps any route that requires a full account.
 * - Authed user  → renders children normally
 * - Guest user   → redirects to /passport-locked (hard lock page)
 * - Not authed   → redirects to /login with return path saved in state
 *
 * Usage in router:
 *   <Route path="/passport" element={<ProtectedRoute><PassportPage /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children }) {
  const { isAuthed, isGuest, loading } = useAuth();
  const location = useLocation();

  // Wait for localStorage hydration before making a redirect decision
  if (loading) return null;

  if (isAuthed) return children;

  // Guest or unauthenticated — send to passport locked page
  // Save where they were trying to go so we can redirect after signup
  return (
    <Navigate
      to="/passport-locked"
      replace
      state={{ redirectTo: location.pathname }}
    />
  );
}