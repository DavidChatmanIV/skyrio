// Adds two pages to src/AppRoutes.jsx:
//   /admin/skyhub      → SkyHub reports & appeals (admin)
//   /skyhub/guidelines → community guidelines (public)
// Run from frontend/my-app:  node scripts/add-admin-skyhub-route.mjs   (safe to run twice)
import fs from "node:fs";

const file = "src/AppRoutes.jsx";
let src = fs.readFileSync(file, "utf8");
const log = [];

function addLazy(line, after) {
  if (src.includes(line.split("=")[0].trim())) return log.push(`• already imported: ${line.split(" ")[1]}`);
  const anchor = after && src.match(after);
  if (anchor) src = src.replace(anchor[0], `${anchor[0]}\n${line}`);
  else {
    const lazies = [...src.matchAll(/^const \w+ = lazy\(.*\);\s*$/gm)];
    if (!lazies.length) throw new Error("Couldn't find where pages are imported in AppRoutes.jsx");
    const last = lazies[lazies.length - 1][0];
    src = src.replace(last, `${last}\n${line}`);
  }
  log.push(`✓ imported ${line.split(" ")[1]}`);
}
function addRoute(line, anchors) {
  const path = line.match(/path="([^"]+)"/)[1];
  if (src.includes(`path="${path}"`)) return log.push(`• route already there: /${path}`);
  const anchor = anchors.map((a) => src.match(a)).find(Boolean);
  if (!anchor) throw new Error(`Couldn't place the /${path} route — add this by hand:\n${line}`);
  src = src.replace(anchor[0], `${anchor[0]}\n${line}`);
  log.push(`✓ added /${path}`);
}

// Admin page
addLazy('const AdminSkyHub = lazy(() => import("./pages/admin/AdminSkyHub"));', /^const AdminBookings = lazy\(.*\);\s*$/m);
addRoute('      <Route path="admin/skyhub" element={<AdminSkyHub />} />', [
  /^\s*<Route path="admin\/bookings"[^\n]*\/>\s*$/m,
  /^\s*<Route path="admin\/support"[^\n]*\/>\s*$/m,
  /^\s*<Route path="admin"[^\n]*\/>\s*$/m,
]);

// Guidelines page — lives next to SkyHubPage
const skyImport = src.match(/^const (\w+) = lazy\(\(\) => import\(["'](\.\/[^"']*?)\/SkyHubPage["']\)\);\s*$/m);
let dir = skyImport ? skyImport[2] : null;
if (!dir) {
  const found = (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      const p = `${d}/${n}`;
      if (fs.statSync(p).isDirectory() && n !== "node_modules") {
        const r = walk(p);
        if (r) return r;
      } else if (n === "SkyHubPage.jsx") return d;
    }
    return null;
  })("src");
  dir = found ? "./" + found.replace(/^src\/?/, "") : "./pages/skyhub";
}
addLazy(`const SkyHubGuidelines = lazy(() => import("${dir}/SkyHubGuidelines"));`, skyImport ? new RegExp(`^${skyImport[0].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m") : null);
addRoute('      <Route path="skyhub/guidelines" element={<SkyHubGuidelines />} />', [
  /^\s*<Route path="skyhub"[^\n]*\/>\s*$/m,
  /^\s*<Route path="sync-together"[^\n]*\/>\s*$/m,
  /^\s*<Route path="admin\/skyhub"[^\n]*\/>\s*$/m,
]);

fs.writeFileSync(file, src);
console.log(log.join("\n"));
