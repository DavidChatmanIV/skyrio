import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layout/AppLayout";

// ---------- Public Pages ----------
import LandingPage from "./pages/LandingPage";
import BookingPage from "./pages/BookingPage";

// ---------- SkyHub ----------
import SkyHubPage from "./pages/skyhub/SkyHubPage";

// ---------- Passport ----------
import DigitalPassportPage from "./pages/passport/DigitalPassportPage";
import MembershipPage from "./pages/passport/Membership";

// ---------- Auth + misc ----------
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFound from "./pages/NotFound";

// ---------- Sync Together (replaces Team Travel) ----------
import SyncTogether from "./pages/SyncTogether";

// ---------- Protected ----------
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public */}
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Core */}
        <Route path="booking" element={<BookingPage />} />

        {/* SkyHub */}
        <Route path="skyhub" element={<SkyHubPage />} />

        {/* Legacy redirects */}
        <Route path="skystream" element={<Navigate to="/skyhub" replace />} />
        <Route path="feed" element={<Navigate to="/skyhub" replace />} />

        {/* Passport */}
        <Route path="passport" element={<DigitalPassportPage />} />
        <Route
          path="digital-passport"
          element={<Navigate to="/passport" replace />}
        />
        <Route path="membership" element={<MembershipPage />} />

        {/* Sync Together — old team-travel URL redirects here too */}
        <Route path="sync-together" element={<SyncTogether />} />
        <Route
          path="team-travel"
          element={<Navigate to="/sync-together" replace />}
        />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}