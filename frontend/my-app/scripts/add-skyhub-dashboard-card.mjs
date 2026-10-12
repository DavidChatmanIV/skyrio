// Adds a "SkyHub reports" card to the admin dashboard, under the Bookings
// card, showing how many reports and appeals are waiting.
// Run from frontend/my-app:  node scripts/add-skyhub-dashboard-card.mjs   (safe to run twice)
import fs from "node:fs";

const file = ["src/pages/admin/AdminDashboard.jsx", "src/pages/AdminDashboard.jsx"].find((f) => fs.existsSync(f));
if (!file) {
  console.error("✗ AdminDashboard.jsx not found. Run this from frontend/my-app.");
  process.exit(1);
}
let s = fs.readFileSync(file, "utf8");
if (s.includes("useSkyHubModerationCount")) {
  console.log("• SkyHub card is already on the dashboard.");
  process.exit(0);
}
fs.writeFileSync(file + ".bak", s);

const hook = `// Reports + appeals waiting in SkyHub moderation.
function useSkyHubModerationCount() {
  const [counts, setCounts] = useState({ reports: 0, appeals: 0 });
  useEffect(() => {
    const token = localStorage.getItem("token");
    const adminEmail = localStorage.getItem("admin_email");
    fetch(apiUrl("/api/skyhub/admin/open-counts"), {
      credentials: "include",
      headers: {
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        ...(adminEmail ? { "x-admin-email": adminEmail } : {}),
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCounts({ reports: j.reports || 0, appeals: j.appeals || 0 }))
      .catch(() => {});
  }, []);
  return counts;
}

const AdminDashboard = () => {`;
if (!s.includes("const AdminDashboard = () => {")) {
  console.error("✗ Couldn't find `const AdminDashboard = () => {` — send me the file and I'll add it by hand.");
  process.exit(1);
}
s = s.replace("const AdminDashboard = () => {", hook);

const useLine = s.match(/^\s*const openTickets = useSupportCount\(\);\s*$/m);
if (!useLine) {
  console.error("✗ Couldn't find useSupportCount() — send me the file.");
  process.exit(1);
}
s = s.replace(useLine[0], `${useLine[0]}\n  const skyhubQueue = useSkyHubModerationCount();`);

const card = `        <div
          className="sk-admin__support-banner"
          onClick={() => navigate("/admin/skyhub")}
        >
          <div className="sk-admin__support-banner-left">
            <div className="sk-admin__support-icon">🛡️</div>
            <div>
              <div className="sk-admin__support-title">
                SkyHub reports
                {skyhubQueue.reports + skyhubQueue.appeals > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: 99,
                      padding: "1px 8px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {skyhubQueue.reports + skyhubQueue.appeals}
                  </span>
                )}
              </div>
              <div className="sk-admin__support-sub">
                {skyhubQueue.reports} to review · {skyhubQueue.appeals} appeal{skyhubQueue.appeals === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <span className="sk-admin__support-arrow">→</span>
        </div>

        <div className="sk-admin__section-title">Overview</div>`;
if (!s.includes(`<div className="sk-admin__section-title">Overview</div>`)) {
  console.error("✗ Couldn't find the Overview section — send me the file.");
  process.exit(1);
}
s = s.replace(`        <div className="sk-admin__section-title">Overview</div>`, card);
fs.writeFileSync(file, s);
console.log(`✓ Added the SkyHub reports card to ${file} (backup: ${file}.bak)`);
