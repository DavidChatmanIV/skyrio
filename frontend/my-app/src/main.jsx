import * as Sentry from "@sentry/react";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App } from "antd";
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

// ── Sentry ────────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  enabled: import.meta.env.PROD,
});

// ── Vercel Analytics ──────────────────────────────────────────────────────────
// No import needed — Vercel automatically injects analytics for projects
// deployed on Vercel. Page views appear in your Vercel dashboard instantly.

// ── bfcache fix ───────────────────────────────────────────────────────────────
// Mobile browsers (Chrome + Safari) restore pages from memory when you reopen
// the browser app. If the page was mid-load or errored, it restores that broken
// state — showing a blank screen. This forces a clean reload in that case.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// ── Stale chunk fix ───────────────────────────────────────────────────────────
// After a new deploy, Vite's hashed chunk names change (e.g.
// BookingPage-XXXX.css). A visitor still on the old version who navigates to a
// lazy-loaded page asks for a chunk that no longer exists, which caused the
// "Unable to preload CSS" and "'text/html' is not a valid JavaScript MIME type"
// errors in Sentry. Reload once to pick up the new build. The session flag
// stops an endless reload loop if something else is actually broken.
const CHUNK_RELOAD_KEY = "skyrio-chunk-reload";

window.addEventListener("vite:preloadError", (event) => {
  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  } catch {
    // storage blocked (private mode etc.) — fall through and reload once
  }

  if (!alreadyReloaded) {
    event.preventDefault(); // don't report this one to Sentry; we're handling it
    try {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } catch {
      /* ignore */
    }
    window.location.reload();
  }
  // If we already reloaded once and it still fails, let the error through
  // so Sentry captures a real problem.
});

// Clear the flag once the app has loaded fine, so the next deploy can
// trigger a reload again during this same tab session.
window.addEventListener("load", () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* ignore */
    }
  }, 10000);
});

// ── Mount ─────────────────────────────────────────────────────────────────────
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
            {/* App must be inside ConfigProvider so it inherits the theme.
                This enables message/notification/modal to consume dynamic
                theme context — fixes the antd static message warning. */}
            <App>
              <AppRoutes />
            </App>
          </ConfigProvider>
        </AtlasProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
