import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";

/* ============================= */
/* Providers */
/* ============================= */
import AuthProvider from "@/auth/AuthProvider.jsx";

/* ============================= */
/* Routes */
/* ============================= */
import AppRoutes from "./AppRoutes";

/* ============================= */
/* CSS load order */
/* ============================= */
import "antd/dist/reset.css";
import "./style.css";

import "./styles/global.css";
import "./styles/Navbar.css";
import "./styles/LandingPage.css";
import "./styles/BookingPage.css";
import "./styles/flights.css";
import "./styles/skyhub.css";
import "./styles/profile-passport.css";
import "./styles/SmartPlan.css";
import "./styles/surfaces.css";
import "./styles/OverlayTone.css";
import "./styles/theme.css";

/* ============================= */
/* Render */
/* ============================= */
const rootEl = document.getElementById("root");

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfigProvider
          theme={{
            components: {
              Card: { variant: "outlined" },
            },
          }}
        >
          <AppRoutes />
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);