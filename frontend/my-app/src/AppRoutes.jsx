import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RequireAccount from "./components/RequireAccount";
import { useAuth } from "./auth/useAuth";
import CookieBanner from "./components/CookieBanner";
// Reload-safe React.lazy: survives stale chunks after a deploy.
import { lazyWithReload as lazy } from "./utils/lazyWithReload";

// ── Core pages ──
const LandingPage = lazy(() => import("./pages/LandingPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const SkyHubPage = lazy(() => import("./pages/skyhub/SkyHubPage"));
const SkyHubGuidelines = lazy(() => import("./pages/skyhub/SkyHubGuidelines"));
const DigitalPassportPage = lazy(() =>
  import("./pages/passport/DigitalPassportPage")
);
// Passport Rewards — the XP redemption store, linked from the
// "Passport Rewards" button in DigitalPassportPage's sidebar actions stack.
const PassportRewardsPage = lazy(() =>
  import("./pages/passport/PassportRewards")
);
const MembershipPage = lazy(() => import("./pages/Membership/MembershipPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SyncTogether = lazy(() => import("./pages/SyncTogether"));
const SyncTogetherLock = lazy(() => import("./pages/SyncTogetherLock"));
const SyncGroupPage = lazy(() => import("./pages/SyncGroupPage"));
const JoinTripPage = lazy(() => import("./pages/JoinTripPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SavedTripsPage = lazy(() => import("./pages/SavedTripsPage"));

// Flight checkout return page — Stripe sends the traveler here after
// paying, and this page finalizes the booking with the airline.
const FlightBookingComplete = lazy(() =>
  import("./pages/booking/FlightBookingComplete")
);
// Atlas "Review & pay" card opens this: loads the flight/room picked in
// Atlas and shows the normal BookingCheckout / HotelCheckout. Guests too.
const AtlasCheckoutPage = lazy(() =>
  import("./pages/booking/AtlasCheckoutPage")
);
// Group split payments — "pay your share" link sent to each member.
const PayShare = lazy(() => import("./pages/booking/PayShare"));

// Public passport page — no auth required, drives signups
const PublicPassportPage = lazy(() =>
  import("./pages/passport/PublicPassportPage")
);

// ── Admin (standalone — no AppLayout/navbar) ──
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SupportInbox = lazy(() => import("./pages/admin/SupportInbox"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminSkyHub = lazy(() => import("./pages/admin/AdminSkyHub"));

// ── Legal ──
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));

// ─── Page loader ──────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0617",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(255,138,42,0.2)",
          borderTop: "3px solid #ff8a2a",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Analytics tracker ────────────────────────────────────────────────────────
function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== "undefined" && window.mixpanel?.track) {
      window.mixpanel.track("Page View", {
        path: location.pathname,
        search: location.search,
      });
    }
  }, [location.pathname, location.search]);
}

// ─── Inner component ──────────────────────────────────────────────────────────
function TrackedRoutes() {
  usePageTracking();
  const { isAuthed, loading } = useAuth();

  return (
    <Routes>
      {/* ── Admin — standalone, no navbar ── */}
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="admin" element={<AdminDashboard />} />
      <Route path="admin/support" element={<SupportInbox />} />
      <Route path="admin/bookings" element={<AdminBookings />} />
      <Route path="admin/skyhub" element={<AdminSkyHub />} />

      {/* Public passport — outside AppLayout so it has its own nav/CTA bar */}
      <Route path="u/:username" element={<PublicPassportPage />} />

      {/* ── Main app with AppLayout (navbar + footer) ── */}
      <Route element={<AppLayout />}>
        {/* ── Open to everyone ── */}
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset" element={<ForgotPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="booking" element={<BookingPage />} />

        {/* Not locked on purpose: a login redirect here could interrupt
            finishing a booking that was already paid for. */}
        <Route
          path="checkout/flight/complete"
          element={<FlightBookingComplete />}
        />

        {/* Public on purpose: guests book through Atlas too. */}
        <Route path="checkout/atlas/:id" element={<AtlasCheckoutPage />} />

        {/* Public — PayShare handles a logged-out visitor itself. */}
        <Route
          path="pay-share/:splitPaymentId/:shareId"
          element={<PayShare />}
        />

        {/* SkyHub stays open to browse. Lock posting/liking inside the page. */}
        <Route path="skyhub" element={<SkyHubPage />} />
        <Route path="skyhub/guidelines" element={<SkyHubGuidelines />} />
        <Route path="skystream" element={<Navigate to="/skyhub" replace />} />
        <Route path="feed" element={<Navigate to="/skyhub" replace />} />

        {/* Plans and prices stay public so people can see what they'd get. */}
        <Route path="membership" element={<MembershipPage />} />
        <Route path="upgrade" element={<UpgradePage />} />

        {/* ── Account-only features ── */}
        <Route
          path="passport"
          element={
            <RequireAccount
              feature="Digital Passport"
              benefit="Earn XP on every trip, collect stamps and climb the ranks."
            >
              <DigitalPassportPage />
            </RequireAccount>
          }
        />
        <Route
          path="passport/rewards"
          element={
            <RequireAccount
              feature="Passport Rewards"
              benefit="Spend the XP you earn on rewards from the catalog."
            >
              <PassportRewardsPage />
            </RequireAccount>
          }
        />
        <Route
          path="digital-passport"
          element={<Navigate to="/passport" replace />}
        />

        <Route
          path="saved-trips"
          element={
            <RequireAccount
              feature="Saved Trips"
              benefit="Save trips you like and come back to them anytime."
            >
              <SavedTripsPage />
            </RequireAccount>
          }
        />

        {/* Sync Together keeps its own custom lock page */}
        <Route
          path="sync-together"
          element={
            loading ? null : isAuthed ? <SyncTogether /> : <SyncTogetherLock />
          }
        />
        {/* Public invite link — JoinTripPage has its own inline login/signup.
            Must stay its own literal route (two segments after sync-together). */}
        <Route path="sync-together/join/:code" element={<JoinTripPage />} />
        <Route
          path="sync-together/:id"
          element={
            <RequireAccount
              feature="Sync Together"
              benefit="Plan trips with friends and each pay your own share."
            >
              <SyncGroupPage />
            </RequireAccount>
          }
        />
        <Route
          path="team-travel"
          element={<Navigate to="/sync-together" replace />}
        />

        {/* ── Legal ── */}
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsOfServicePage />} />
        <Route path="cookies" element={<CookiePolicyPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CookieBanner />
      <TrackedRoutes />
    </Suspense>
  );
}
