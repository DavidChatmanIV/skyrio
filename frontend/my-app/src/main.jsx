import * as Sentry from "@sentry/react";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import AuthProvider from "@/auth/AuthProvider.jsx";
import { AtlasProvider } from "@/components/Atlas/AtlasContext";
import AppRoutes from "./AppRoutes";
import "antd/dist/reset.css";
import "./style.css";
import "./styles/global.css";
import "./styles/Navbar.css";
import "./styles/LandingPage.css";
import "./styles/BookingPage.css";
import "./styles/flights.css";
import "./styles/SkyHubPage.css";
import "./styles/profile-passport.css";
import "./styles/SmartPlan.css";
import "./styles/surfaces.css";
import "./styles/OverlayTone.css";
import "./styles/theme.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  enabled: import.meta.env.PROD,
});

const rootEl = document.getElementById("root");

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AtlasProvider>
          <ConfigProvider
            theme={{
              components: {
                Card: { variant: "outlined" },
              },
            }}
          >
            <AppRoutes />
          </ConfigProvider>
        </AtlasProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
