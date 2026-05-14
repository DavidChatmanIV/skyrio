import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { apiUrl } from "@/lib/api";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#07060f",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(255,138,42,0.3)",
  orange: "#ff8a2a",
  orangeDim: "rgba(255,138,42,0.12)",
  purple: "#7c5cfc",
  purpleDim: "rgba(124,92,252,0.12)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.12)",
  blue: "#60a5fa",
  blueDim: "rgba(96,165,250,0.12)",
  white: "#fff",
  muted: "rgba(255,255,255,0.45)",
};

const INJECTED_CSS = `
  .sk-admin * { box-sizing: border-box; }
  .sk-admin { min-height: 100vh; background: ${C.bg}; color: ${C.white}; font-family: "DM Sans", sans-serif; }
  .sk-admin__topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid ${C.border};
    position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
  }
  .sk-admin__logo { font-family: "Syne", sans-serif; font-size: 16px; font-weight: 800; color: ${C.white}; display: flex; align-items: center; gap: 8px; }
  .sk-admin__badge { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; background: ${C.orangeDim}; border: 1px solid ${C.borderAccent}; color: ${C.orange}; border-radius: 999px; padding: 3px 10px; }
  .sk-admin__body { padding: 32px; max-width: 1300px; margin: 0 auto; }
  .sk-admin__section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${C.muted}; margin-bottom: 16px; }
  .sk-admin__stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  @media (max-width: 900px) { .sk-admin__stats { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 500px) { .sk-admin__stats { grid-template-columns: 1fr; } }
  .sk-stat { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; padding: 20px; transition: border-color .2s, transform .2s; }
  .sk-stat:hover { border-color: rgba(255,255,255,0.16); transform: translateY(-2px); }
  .sk-stat__icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; margin-bottom: 14px; }
  .sk-stat__val { font-family: "Syne", sans-serif; font-size: 28px; font-weight: 800; color: ${C.white}; line-height: 1; margin-bottom: 4px; }
  .sk-stat__label { font-size: 12px; color: ${C.muted}; }
  .sk-admin__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media (max-width: 860px) { .sk-admin__grid { grid-template-columns: 1fr; } }
  .sk-admin__card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; overflow: hidden; }
  .sk-admin__card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-admin__card-title { font-size: 13px; font-weight: 700; color: ${C.white}; }
  .sk-admin__card-count { font-size: 11px; color: ${C.muted}; background: rgba(255,255,255,0.06); border-radius: 999px; padding: 2px 10px; }
  .sk-admin__row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid ${C.border}; transition: background .15s; }
  .sk-admin__row:last-child { border-bottom: none; }
  .sk-admin__row:hover { background: rgba(255,255,255,0.03); }
  .sk-admin__row-left { display: flex; align-items: center; gap: 10px; }
  .sk-admin__avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, ${C.purple}, ${C.orange}); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${C.white}; flex-shrink: 0; overflow: hidden; }
  .sk-admin__name { font-size: 13px; font-weight: 600; color: ${C.white}; }
  .sk-admin__sub { font-size: 11px; color: ${C.muted}; margin-top: 1px; }
  .sk-admin__pill { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 3px 10px; }
  .sk-admin__feed { display: flex; flex-direction: column; }
  .sk-admin__feed-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-admin__feed-item:last-child { border-bottom: none; }
  .sk-admin__feed-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .sk-admin__feed-text { font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .sk-admin__feed-time { font-size: 11px; color: ${C.muted}; margin-top: 2px; }
  .sk-admin__rev { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; }
  .sk-admin__rev-row { display: flex; flex-direction: column; gap: 5px; }
  .sk-admin__rev-label { display: flex; justify-content: space-between; font-size: 12px; color: ${C.muted}; }
  .sk-admin__rev-bar { height: 6px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; }
  .sk-admin__rev-fill { height: 100%; border-radius: 999px; transition: width 0.8s ease; }
  .sk-admin__spinner { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${C.orange}; animation: sk-spin 0.7s linear infinite; display: inline-block; }
  @keyframes sk-spin { to { transform: rotate(360deg); } }
  .sk-admin__empty { padding: 32px; text-align: center; font-size: 13px; color: ${C.muted}; }
  .sk-admin__topbtn { background: none; border: 1px solid ${C.border}; color: ${C.muted}; padding: 6px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; transition: border-color .2s, color .2s; }
  .sk-admin__topbtn:hover { border-color: ${C.orange}; color: ${C.orange}; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = "") {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function fmt$(n) {
  return `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }) {
  const map = {
    confirmed: { bg: C.greenDim, color: C.green },
    pending: { bg: C.orangeDim, color: C.orange },
    cancelled: { bg: C.redDim, color: C.red },
  };
  const s = map[status] || { bg: C.card, color: C.muted };
  return (
    <span
      className="sk-admin__pill"
      style={{ background: s.bg, color: s.color }}
    >
      {status || "unknown"}
    </span>
  );
}

function LevelPill({ xp = 0 }) {
  const level =
    xp >= 2000
      ? { label: "Legend", color: C.orange }
      : xp >= 1000
      ? { label: "Expert", color: C.purple }
      : xp >= 500
      ? { label: "Adventurer", color: C.blue }
      : xp >= 200
      ? { label: "Traveler", color: C.green }
      : { label: "Explorer", color: C.muted };
  return (
    <span
      className="sk-admin__pill"
      style={{ background: level.color + "20", color: level.color }}
    >
      {level.label}
    </span>
  );
}

function StatCard({ icon, label, value, color, dim }) {
  return (
    <div className="sk-stat">
      <div className="sk-stat__icon" style={{ background: dim, color }}>
        {icon}
      </div>
      <div className="sk-stat__val">
        {value ?? <span className="sk-admin__spinner" />}
      </div>
      <div className="sk-stat__label">{label}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  // ── Guard: redirect if not logged in ──
  useEffect(() => {
    const isAdmin = localStorage.getItem("admin");
    if (!isAdmin) navigate("/admin/login");
  }, [navigate]);

  // ── Fetch dashboard data ──
  // Sends x-admin-email header as fallback for localhost (cookie doesn't
  // cross ports in dev — cookie works fine on Vercel/production)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/dashboard"), {
        credentials: "include",
        headers: {
          "x-admin-email": localStorage.getItem("admin_email") || "",
        },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin");
        localStorage.removeItem("admin_email");
        navigate("/admin/login");
        return;
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to load");
      setData(json.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || "Could not load dashboard.");
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch(apiUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include",
    });
    localStorage.removeItem("admin");
    localStorage.removeItem("admin_email");
    navigate("/admin/login");
  };

  const stats = data?.stats || {};
  const users = data?.recentUsers || [];
  const bookings = data?.recentBookings || [];
  const activity = data?.recentActivity || [];
  const revenue = data?.revenueByStatus || {};

  return (
    <div className="sk-admin">
      <style>{INJECTED_CSS}</style>

      {/* Top bar */}
      <div className="sk-admin__topbar">
        <div className="sk-admin__logo">
          ✦ Skyrio <span className="sk-admin__badge">Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: C.muted }}>
              Updated {timeAgo(lastRefresh)}
            </span>
          )}
          <button
            className="sk-admin__topbtn"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
          <button className="sk-admin__topbtn" onClick={() => navigate("/")}>
            ← Skyrio
          </button>
          <Button type="primary" danger size="small" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="sk-admin__body">
        {error && (
          <div
            style={{
              background: C.redDim,
              border: `1px solid ${C.red}44`,
              borderRadius: 12,
              padding: "14px 20px",
              color: C.red,
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ── Stats row 1 ── */}
        <div className="sk-admin__section-title">Overview</div>
        <div className="sk-admin__stats">
          <StatCard
            icon="👤"
            label="Total Users"
            value={stats.totalUsers}
            color={C.purple}
            dim={C.purpleDim}
          />
          <StatCard
            icon="✈️"
            label="Total Bookings"
            value={stats.totalBookings}
            color={C.orange}
            dim={C.orangeDim}
          />
          <StatCard
            icon="💰"
            label="Confirmed Revenue"
            value={
              stats.totalRevenue != null ? fmt$(stats.totalRevenue) : undefined
            }
            color={C.green}
            dim={C.greenDim}
          />
          <StatCard
            icon="🌟"
            label="Total XP Awarded"
            value={
              stats.totalXP != null ? stats.totalXP.toLocaleString() : undefined
            }
            color={C.blue}
            dim={C.blueDim}
          />
        </div>

        {/* ── Stats row 2 ── */}
        <div className="sk-admin__stats" style={{ marginBottom: 32 }}>
          <StatCard
            icon="📅"
            label="New Users (7d)"
            value={stats.newUsersWeek}
            color={C.purple}
            dim={C.purpleDim}
          />
          <StatCard
            icon="🎫"
            label="Bookings (7d)"
            value={stats.newBookingsWeek}
            color={C.orange}
            dim={C.orangeDim}
          />
          <StatCard
            icon="✅"
            label="Confirmed"
            value={stats.confirmedBookings}
            color={C.green}
            dim={C.greenDim}
          />
          <StatCard
            icon="⏳"
            label="Pending"
            value={stats.pendingBookings}
            color={C.blue}
            dim={C.blueDim}
          />
        </div>

        {/* ── Users + Bookings ── */}
        <div className="sk-admin__grid">
          {/* Recent users */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Users</span>
              <span className="sk-admin__card-count">{users.length} shown</span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && users.length === 0 && (
              <div className="sk-admin__empty">No users yet</div>
            )}
            {users.map((u) => (
              <div key={u._id} className="sk-admin__row">
                <div className="sk-admin__row-left">
                  <div className="sk-admin__avatar">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      initials(u.name || u.username)
                    )}
                  </div>
                  <div>
                    <div className="sk-admin__name">{u.name || u.username}</div>
                    <div className="sk-admin__sub">
                      {u.email} · {timeAgo(u.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LevelPill xp={u.xp} />
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: C.orange }}
                  >
                    {(u.xp || 0).toLocaleString()} XP
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent bookings */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Bookings</span>
              <span className="sk-admin__card-count">
                {bookings.length} shown
              </span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && bookings.length === 0 && (
              <div className="sk-admin__empty">No bookings yet</div>
            )}
            {bookings.map((b) => (
              <div key={b._id} className="sk-admin__row">
                <div className="sk-admin__row-left">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: C.orangeDim,
                      border: `1px solid ${C.borderAccent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    ✈️
                  </div>
                  <div>
                    <div className="sk-admin__name">
                      {b.flight?.origin || "?"} → {b.flight?.destination || "?"}
                    </div>
                    <div className="sk-admin__sub">
                      {b.travelers?.[0]?.email || "Unknown"} ·{" "}
                      {timeAgo(b.createdAt)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <StatusPill status={b.status} />
                  {b.total != null && (
                    <span
                      style={{ fontSize: 12, color: C.green, fontWeight: 700 }}
                    >
                      {fmt$(b.total)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Activity feed + Revenue ── */}
        <div className="sk-admin__grid">
          {/* Activity feed */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Activity</span>
              <span className="sk-admin__card-count">Notifications</span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && activity.length === 0 && (
              <div className="sk-admin__empty">No activity yet</div>
            )}
            <div className="sk-admin__feed">
              {activity.map((a) => {
                const dotColor =
                  a.type === "booking"
                    ? C.green
                    : a.type === "xp"
                    ? C.orange
                    : a.type === "signup"
                    ? C.purple
                    : C.blue;
                return (
                  <div key={a._id} className="sk-admin__feed-item">
                    <div
                      className="sk-admin__feed-dot"
                      style={{ background: dotColor }}
                    />
                    <div>
                      <div className="sk-admin__feed-text">
                        {a.message || a.title}
                      </div>
                      <div className="sk-admin__feed-time">
                        {timeAgo(a.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue + Top XP */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Revenue Breakdown</span>
              <span className="sk-admin__card-count" style={{ color: C.green }}>
                {fmt$(stats.totalRevenue || 0)}
              </span>
            </div>
            <div className="sk-admin__rev">
              {[
                { label: "Confirmed", key: "confirmed", color: C.green },
                { label: "Pending", key: "pending", color: C.orange },
                { label: "Cancelled", key: "cancelled", color: C.red },
              ].map(({ label, key, color }) => {
                const val = revenue[key] || 0;
                const total =
                  (revenue.confirmed || 0) +
                  (revenue.pending || 0) +
                  (revenue.cancelled || 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <div key={key} className="sk-admin__rev-row">
                    <div className="sk-admin__rev-label">
                      <span>{label}</span>
                      <span style={{ color }}>
                        {fmt$(val)} · {pct}%
                      </span>
                    </div>
                    <div className="sk-admin__rev-bar">
                      <div
                        className="sk-admin__rev-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Top XP earners */}
              <div
                style={{
                  marginTop: 16,
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: C.muted,
                    marginBottom: 12,
                  }}
                >
                  Top XP Earners
                </div>
                {(data?.topXP || []).map((u, i) => (
                  <div
                    key={u._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 11, color: C.muted, width: 16 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: C.white }}>
                        {u.name || u.username}
                      </span>
                    </div>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: C.orange }}
                    >
                      {(u.xp || 0).toLocaleString()} XP
                    </span>
                  </div>
                ))}
                {(!data?.topXP || data.topXP.length === 0) && (
                  <div style={{ fontSize: 12, color: C.muted }}>
                    No XP data yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
