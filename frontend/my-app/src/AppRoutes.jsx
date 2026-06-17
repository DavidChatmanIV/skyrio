import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useAuth } from "./auth/useAuth";
import CookieBanner from "./components/CookieBanner";

// ── Core pages ──
const LandingPage = lazy(() => import("./pages/LandingPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const SkyHubPage = lazy(() => import("./pages/skyhub/SkyHubPage"));
const DigitalPassportPage = lazy(() =>
  import("./pages/passport/DigitalPassportPage")
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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SavedTripsPage = lazy(() => import("./pages/SavedTripsPage"));

// ✅ s2: Public passport page — no auth required, drives signups
const PublicPassportPage = lazy(() =>
  import("./pages/passport/PublicPassportPage")
);

// ── Admin (standalone — no AppLayout/navbar) ──
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SupportInbox = lazy(() => import("./pages/admin/SupportInbox"));

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

      {/* ✅ s2: Public passport — outside AppLayout so it has its own nav/CTA bar */}
      <Route path="u/:username" element={<PublicPassportPage />} />

      {/* ── Main app with AppLayout (navbar + footer) ── */}
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset" element={<ForgotPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="skyhub" element={<SkyHubPage />} />
        <Route path="skystream" element={<Navigate to="/skyhub" replace />} />
        <Route path="feed" element={<Navigate to="/skyhub" replace />} />
        <Route path="passport" element={<DigitalPassportPage />} />
        <Route
          path="digital-passport"
          element={<Navigate to="/passport" replace />}
        />
        <Route path="membership" element={<MembershipPage />} />
        <Route path="upgrade" element={<UpgradePage />} />

        {/* ── Sync Together — login wall for guests, full page for authed users ── */}
        <Route
          path="sync-together"
          element={
            loading ? null : isAuthed ? <SyncTogether /> : <SyncTogetherLock />
          }
        />
        <Route path="sync-together/:id" element={<SyncGroupPage />} />
        <Route
          path="team-travel"
          element={<Navigate to="/sync-together" replace />}
        />

        <Route path="saved-trips" element={<SavedTripsPage />} />

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
