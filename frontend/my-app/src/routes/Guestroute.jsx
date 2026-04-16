import { useAuth } from "../auth/useAuth";

/**
 * GuestRoute
 *
 * Soft-open wrapper — does NOT redirect.
 * The page renders for everyone (authed, guest, or anonymous).
 * Children receive isGuest via useAuth() and handle their own
 * locked/unlocked UI states.
 *
 * Usage in router:
 *   <Route path="/skyhub" element={<GuestRoute><SkyHubFeed /></GuestRoute>} />
 */
export default function GuestRoute({ children }) {
  const { loading } = useAuth();

  // Wait for hydration so children don't flash wrong state
  if (loading) return null;

  return children;
}