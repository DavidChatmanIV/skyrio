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

// Admin
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SupportInbox from "./pages/admin/SupportInbox";

// Legal
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";

// Membership
import MembershipPage from "./pages/Membership/MembershipPage";

// Sync Together (Group Travel)
import SyncTogether from "./pages/SyncTogether";
import SyncGroupPage from "./pages/SyncGroupPage";

// ── Analytics + scroll restoration ────────────────────────────────────────────
function AppWithTracking() {
  const location = useLocation();

  // ── Scroll to top on route change ──
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ── Analytics ──
  useEffect(() => {
    if (typeof window !== "undefined" && window.mixpanel?.track) {
      window.mixpanel.track("Page View", {
        path: location.pathname,
        search: location.search,
      });
    }
  }, [location.pathname, location.search]);

  return (
    <Routes>
      {/* ── Admin — no Layout/navbar ── */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/support" element={<SupportInbox />} />

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

        {/* Membership */}
        <Route
          path="/membership"
          element={
            <PrivateRoute>
              <MembershipPage />
            </PrivateRoute>
          }
        />

        {/* Sync Together (Group Travel) */}
        <Route
          path="/sync-together"
          element={
            <PrivateRoute>
              <SyncTogether />
            </PrivateRoute>
          }
        />
        <Route
          path="/sync-together/:id"
          element={
            <PrivateRoute>
              <SyncGroupPage />
            </PrivateRoute>
          }
        />
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
