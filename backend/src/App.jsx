import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";
import Home from "./components/Home";
import ProfileForm from "./components/ProfileForm";
import SavedTrips from "./components/SavedTrips";
import Explore from "./components/Explore";
import Dashboard from "./components/Dashboard";
import QuestFeed from "./components/QuestFeed";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";

// SkyHub
import SkyHubLayout from "./pages/skyhub/SkyHubLayout";
import MomentsFeed from "./pages/skyhub/MomentsFeed";
import CirclesPage from "./pages/skyhub/CirclesPage";
import DmPage from "./pages/skyhub/DmPage";
import SkyHubInsights from "./pages/skyhub/SkyHubInsights";
import SavedPage from "./pages/skyhub/SavedPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/explore" element={<Explore />} />

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
    </Router>
  );
}

export default App;