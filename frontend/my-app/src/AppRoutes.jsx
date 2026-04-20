import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const SkyHubPage = lazy(() => import("./pages/skyhub/SkyHubPage"));
const DigitalPassportPage = lazy(() =>
  import("./pages/passport/DigitalPassportPage")
);
const MembershipPage = lazy(() => import("./pages/passport/Membership"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SyncTogether = lazy(() => import("./pages/SyncTogether"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

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

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
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
          <Route path="sync-together" element={<SyncTogether />} />
          <Route
            path="team-travel"
            element={<Navigate to="/sync-together" replace />}
          />
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
