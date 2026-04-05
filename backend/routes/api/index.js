import { Router } from "express";

const api = Router();

/* ======================================================
   Dynamic Mount Helper
====================================================== */
async function mount(routeBase, modulePath) {
  try {
    const mod = await import(modulePath);
    const router = mod.default || mod;
    if (typeof router === "function") {
      api.use(routeBase, router);
      console.log(`[api] Mounted ${routeBase} ← ${modulePath}`);
    } else {
      console.warn(
        `[api] ${modulePath} did not export a router function; skipping.`
      );
    }
  } catch (err) {
    console.error(`[api] FAILED mounting ${routeBase} from ${modulePath}`);
    console.error(`→ code: ${err?.code || "UNKNOWN"}`);
    console.error(`→ message: ${err?.message || "No error message"}`);
    if (err?.stack) {
      console.error("→ stack:");
      console.error(err.stack);
    }
  }
}

/* ======================================================
   Core API Routes (inside /routes/api/)
====================================================== */
await mount("/auth", "./auth.routes.js");
await mount("/profile", "./profile.routes.js");
await mount("/uploads", "./uploads.routes.js");
await mount("/social", "./social.routes.js");
await mount("/follow", "./follow.routes.js");
await mount("/passport", "./passport.routes.js");
await mount("/flights", "./flights.routes.js");
await mount("/airports", "./airports.routes.js");
await mount("/skyhub", "./skyhub.routes.js");
await mount("/weather", "./weather.routes.js");
await mount("/notifications", "./notifications.routes.js");

/* ======================================================
   Extended Modules (outside api folder)
====================================================== */
await mount("/conversations", "../conversations.js");
await mount("/feed", "../feed.js");
await mount("/message", "../message.routes.js");
await mount("/bookings", "../bookings.routes.js");
await mount("/dm", "../dm.js");
await mount("/admin", "../admin.routes.js");

/* ======================================================
   Feature Modules
====================================================== */
await mount("/hotspots", "../hotspots.js");
await mount("/watches", "../watches.js");
await mount("/xp", "../xp.js");

/* ======================================================
   API Root
====================================================== */
api.get("/", (_req, res) => {
  res.json({
    ok: true,
    api: "Skyrio API root",
    endpoints: [
      "/auth",
      "/profile",
      "/passport",
      "/flights",
      "/weather",
      "/skyhub",
      "/dm",
      "/notifications",
    ],
  });
});

export default api;