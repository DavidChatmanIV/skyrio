import fs from "fs";

const candidates = [
  "src/pages/admin/AdminDashboard.jsx",
  "src/pages/AdminDashboard.jsx",
  "src/components/admin/AdminDashboard.jsx",
];
const file = candidates.find((f) => fs.existsSync(f));
if (!file) {
  console.error("✗ AdminDashboard.jsx not found. Run from frontend/my-app, or tell me its path.");
  process.exit(1);
}
let s = fs.readFileSync(file, "utf8");
const orig = s;
const log = [];
const step = (name, doneMarker, from, to) => {
  if (s.includes(doneMarker)) return log.push("  • " + name + ": already done");
  if (!s.includes(from)) return log.push("  ✗ " + name + ": original text not found");
  s = s.replace(from, to);
  log.push("  ✓ " + name);
};

step(
  "count open cancellation requests",
  "function useCancelRequestCount",
  `const AdminDashboard = () => {`,
  `// Open cancellation requests (travelers waiting on a person). Uses the
// signed-in admin account's login token, same as /admin/bookings.
function useCancelRequestCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(apiUrl("/api/bookings/admin/search?status=cancel_requested&limit=1"), {
      headers: { Authorization: \`Bearer \${token}\` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setCount(json?.total || 0))
      .catch(() => setCount(0));
  }, []);
  return count;
}

const AdminDashboard = () => {`
);

step(
  "use the count",
  "const cancelRequests = useCancelRequestCount();",
  `  const openTickets = useSupportCount();`,
  `  const openTickets = useSupportCount();
  const cancelRequests = useCancelRequestCount();`
);

step(
  "Bookings card",
  `navigate("/admin/bookings")}
        >
          <div className="sk-admin__support-banner-left">
            <div className="sk-admin__support-icon">🧳`,
  `        <div className="sk-admin__section-title">Overview</div>`,
  `        <div
          className="sk-admin__support-banner"
          onClick={() => navigate("/admin/bookings")}
        >
          <div className="sk-admin__support-banner-left">
            <div className="sk-admin__support-icon">🧳</div>
            <div>
              <div className="sk-admin__support-title">
                Bookings
                {cancelRequests > 0 && (
                  <span
                    style={{
                      marginLeft: 10,
                      background: "#ffb347",
                      color: "#1a1030",
                      borderRadius: 999,
                      fontSize: 11,
                      padding: "2px 9px",
                      fontWeight: 700,
                    }}
                  >
                    {cancelRequests} cancellation request
                    {cancelRequests > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="sk-admin__support-sub">
                {cancelRequests > 0
                  ? \`\${cancelRequests} traveler\${
                      cancelRequests > 1 ? "s are" : " is"
                    } waiting to hear back about cancelling\`
                  : "Search trips, check live status, cancel and refund, add notes"}
              </div>
            </div>
          </div>
          <div className="sk-admin__support-arrow">→</div>
        </div>

        <div className="sk-admin__section-title">Overview</div>`
);

step(
  "Recent Bookings → View all",
  "View all →",
  `              <span className="sk-admin__card-title">Recent Bookings</span>
              <span className="sk-admin__card-count">
                {bookings.length} shown
              </span>`,
  `              <span className="sk-admin__card-title">Recent Bookings</span>
              <button
                type="button"
                className="sk-admin__challenge-action-btn"
                onClick={() => navigate("/admin/bookings")}
              >
                View all →
              </button>`
);

if (s !== orig) {
  fs.copyFileSync(file, file + ".bak-dashboard");
  fs.writeFileSync(file, s);
}
console.log(file);
log.forEach((l) => console.log(l));
console.log("\nDone. Vite reloads automatically — refresh /admin.");
