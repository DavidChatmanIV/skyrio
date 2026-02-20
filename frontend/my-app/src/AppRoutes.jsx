import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layout/AppLayout";

// ---------- Public Pages ----------
import LandingPage from "./pages/LandingPage";
import BookingPage from "./pages/BookingPage";

// ---------- SkyHub ----------
import SkyHubLayout from "./pages/skyhub/SkyHubLayout";
import SkyHubFeed from "./pages/skyhub/SkyHubFeed";
import SkyHubInsights from "./pages/skyhub/SkyHubInsights";
import DmPage from "./pages/skyhub/DmPage";
import CirclesPage from "./pages/skyhub/CirclesPage";
import SavedPage from "./pages/skyhub/SavedPage";

// ---------- Passport ----------
import DigitalPassportPage from "./pages/passport/DigitalPassportPage";
import MembershipPage from "./pages/passport/Membership";

// ---------- Auth + misc ----------
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFound from "./pages/NotFound";

// ---------- Optional / Legacy ----------
import TeamTravelPage from "./pages/TeamTravelPage";

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
        <Route path="skyhub" element={<SkyHubLayout />}>
          <Route index element={<Navigate to="moments" replace />} />
          <Route path="moments" element={<SkyHubFeed />} />
          <Route path="insights" element={<SkyHubInsights />} />

          {/* ✅ MATCH LeftRail: /skyhub/dms */}
          <Route path="dms" element={<DmPage />} />

          <Route path="circles" element={<CirclesPage />} />
          <Route path="saved" element={<SavedPage />} />
        </Route>

        {/* Legacy */}
        <Route path="skystream" element={<Navigate to="/skyhub" replace />} />
        <Route path="feed" element={<Navigate to="/skyhub" replace />} />

        {/* Passport */}
        <Route path="passport" element={<DigitalPassportPage />} />
        <Route
          path="digital-passport"
          element={<Navigate to="/passport" replace />}
        />
        <Route path="membership" element={<MembershipPage />} />

        {/* Optional */}
        <Route path="team-travel" element={<TeamTravelPage />} />

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