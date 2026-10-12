// Adds the /admin/skyhub page to src/AppRoutes.jsx.
// Run from frontend/my-app:  node scripts/add-admin-skyhub-route.mjs
import fs from "node:fs";

const file = "src/AppRoutes.jsx";
let src = fs.readFileSync(file, "utf8");

if (src.includes("AdminSkyHub")) {
  console.log("✓ /admin/skyhub is already set up — nothing to do.");
  process.exit(0);
}

const lazyLine = 'const AdminSkyHub = lazy(() => import("./pages/admin/AdminSkyHub"));';
const routeLine = '      <Route path="admin/skyhub" element={<AdminSkyHub />} />';

// 1. lazy import — right after AdminBookings' import (or the last lazy import)
const bookingsImport = src.match(/^const AdminBookings = lazy\(.*\);\s*$/m);
if (bookingsImport) {
  src = src.replace(bookingsImport[0], `${bookingsImport[0]}\n${lazyLine}`);
} else {
  const lazies = [...src.matchAll(/^const \w+ = lazy\(.*\);\s*$/gm)];
  if (!lazies.length) throw new Error("Couldn't find where pages are imported in AppRoutes.jsx");
  const last = lazies[lazies.length - 1][0];
  src = src.replace(last, `${last}\n${lazyLine}`);
}

// 2. route — right after the admin/bookings route (or admin/support)
const anchor =
  src.match(/^\s*<Route path="admin\/bookings"[^\n]*\/>\s*$/m) ||
  src.match(/^\s*<Route path="admin\/support"[^\n]*\/>\s*$/m) ||
  src.match(/^\s*<Route path="admin"[^\n]*\/>\s*$/m);
if (!anchor) throw new Error('Couldn\'t find the admin routes in AppRoutes.jsx — add this by hand:\n' + routeLine);
src = src.replace(anchor[0], `${anchor[0]}\n${routeLine}`);

fs.writeFileSync(file, src);
console.log("✓ Added /admin/skyhub to src/AppRoutes.jsx");
