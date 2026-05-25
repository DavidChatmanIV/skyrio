import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Home from "./components/Home";
import ProfileForm from "./components/ProfileForm";
import SavedTrips from "./components/SavedTrips";
import Explore from "./components/Explore";
import Dashboard from "./components/Dashboard";
import QuestFeed from "./components/QuestFeed";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";

// Auth pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// SkyHub
import SkyHubLayout from "./pages/skyhub/SkyHubLayout";
import MomentsFeed from "./pages/skyhub/MomentsFeed";
import CirclesPage from "./pages/skyhub/CirclesPage";
import DmPage from "./pages/skyhub/DmPage";
import SkyHubInsights from "./pages/skyhub/SkyHubInsights";
import SavedPage from "./pages/skyhub/SavedPage";

// Admin
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

// Legal
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";

// Membership 
import MembershipPage from "./pages/Membership/MembershipPage";

// ── Analytics tracker ─────────────────────────────────────────────────────────
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

function AppWithTracking() {
  usePageTracking();
  return (
    <Routes>
      {/* ── Admin — no Layout/navbar ── */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />

      {/* ── Main app with Layout ── */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset" element={<ForgotPasswordPage />} />
        <Route path="/explore" element={<Explore />} />

        {/* Legal */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfileForm />
            </PrivateRoute>
          }
        />
        <Route
          path="/saved-trips"
          element={
            <PrivateRoute>
              <SavedTrips />
            </PrivateRoute>
          }
        />
        <Route
          path="/quest-feed"
          element={
            <PrivateRoute>
              <QuestFeed />
            </PrivateRoute>
          }
        />

        {/* Membership ← NEW */}
        <Route
          path="/membership"
          element={
            <PrivateRoute>
              <MembershipPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/skyhub"
          element={
            <PrivateRoute>
              <SkyHubLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="moments" replace />} />
          <Route path="moments" element={<MomentsFeed />} />
          <Route path="circles" element={<CirclesPage />} />
          <Route path="dms" element={<DmPage />} />
          <Route path="insights" element={<SkyHubInsights />} />
          <Route path="saved" element={<SavedPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppWithTracking />
    </Router>
  );
}

export default App;
