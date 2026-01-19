import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";

import LandingPage from "./pages/LandingPage";
import BookingPage from "./pages/BookingPage";
import CheckoutPage from "./pages/CheckoutPage";
import SkyStreamPage from "./pages/SkyStreamPage";
import DigitalPassportPage from "./pages/DigitalPassportPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();

  const hideNavbar =
    location.pathname === "/login" || location.pathname === "/register";

  return (
    <div className="app-shell">
      {!hideNavbar && <Navbar />}

      <main className="app-main" id="main">
        <Routes>
          {/* ✅ Home / Discover */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/discover" element={<LandingPage />} />

          {/* ✅ Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ✅ Booking */}
          <Route path="/booking" element={<BookingPage />} />
          {/* Alias (matches your proposed /book) */}
          <Route path="/book" element={<BookingPage />} />

          <Route path="/checkout" element={<CheckoutPage />} />

          {/* ✅ SkyHub / SkyStream */}
          <Route path="/skystream" element={<SkyStreamPage />} />
          {/* Alias (matches your proposed /skyhub) */}
          <Route path="/skyhub" element={<SkyStreamPage />} />

          {/* ✅ Passport */}
          <Route path="/passport" element={<DigitalPassportPage />} />
          <Route path="/digital-passport" element={<DigitalPassportPage />} />

          {/* ✅ Profile */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* ✅ Optional: if anything still links to old paths, redirect safely */}
          {/* <Route path="/home" element={<Navigate to="/" replace />} /> */}

          {/* ✅ 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
