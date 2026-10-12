// src/pages/admin/AdminSkyHub.jsx
// Route: /admin/skyhub  (admin-only — the backend enforces it)
//
// SkyHub moderation: everything travelers reported, grouped so each post,
// comment or traveler appears once with all its reasons. From here you can
// dismiss a report, hide or remove the content, and pause someone's SkyHub
// account for a while. Suspensions are listed at the bottom.

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "";

const C = {
  bg: "#120c1f",
  panel: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.09)",
  text: "#f2eefa",
  muted: "rgba(242,238,250,0.6)",
  orange: "#ff8a2a",
  red: "#f87171",
  green: "#52c41a",
  amber: "#ffb347",
};

const authHeaders = () => {
  const token = localStorage.getItem("token");
  const adminEmail = localStorage.getItem("admin_email");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(adminEmail && { "x-admin-email": adminEmail }),
  };
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(), credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

const REASON_LABEL = {
  spam: "Spam",
  scam: "Scam",
  harassment: "Harassment",
  hate: "Hate",
  nudity: "Nudity",
  violence: "Violence",
  misinformation: "Misleading",
  other: "Other",
};

const btn = (variant = "ghost", disabled = false) => ({
  opacity: disabled ? 0.45 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  padding: "8px 13px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  border: `1px solid ${variant === "danger" ? `${C.red}66` : variant === "primary" ? C.orange : C.line}`,
  background: variant === "danger" ? "rgba(248,113,113,.12)" : variant === "primary" ? C.orange : "transparent",
  color: variant === "danger" ? C.red : variant === "primary" ? "#1b1024" : C.text,
});

const when = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function ReportItem({ item, onDone }) {
  const [busy, setBusy] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState("");
  const [showReports, setShowReports] = useState(false);

  const act = async (action) => {
    setBusy(action);
    setError("");
    try {
      await api("/api/skyhub/admin/resolve", {
        method: "POST",
        body: JSON.stringify({
          targetType: item.targetType,
          targetId: item.targetId,
          action,
          days: action === "suspend" ? Number(days) || null : undefined,
          note: action === "suspend" ? Object.keys(item.reasons).join(", ") : undefined,
        }),
      });
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const c = item.content;
  const typeLabel = item.targetType === "post" ? "Post" : item.targetType === "comment" ? "Comment" : "Traveler";

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800 }}>{typeLabel}</span>
          {item.targetUser && (
            <span style={{ color: C.muted }}>
              by {item.targetUser.name} @{item.targetUser.username}
            </span>
          )}
          {item.suspendedUntil && (
            <span style={{ color: C.amber, fontSize: 12 }}>
              · paused {item.suspendedUntil === "indefinite" ? "indefinitely" : `until ${when(item.suspendedUntil)}`}
            </span>
          )}
        </div>
        <div style={{ color: C.muted, fontSize: 12 }}>
          {item.count} report{item.count === 1 ? "" : "s"} · last {when(item.lastAt)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(item.reasons).map(([r, n]) => (
          <span
            key={r}
            style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(248,113,113,.12)", color: C.red }}
          >
            {REASON_LABEL[r] || r} × {n}
          </span>
        ))}
        {c?.hidden && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(255,179,71,.12)", color: C.amber }}>
            {c.hiddenReason === "review" ? "Auto-hidden for review" : "Hidden"}
          </span>
        )}
      </div>

      {c?.deleted ? (
        <div style={{ color: C.muted, fontStyle: "italic" }}>The author already deleted this.</div>
      ) : c ? (
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 12 }}>
          {c.destination && <div style={{ color: C.orange, fontSize: 12, marginBottom: 4 }}>{c.destination}</div>}
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.text}</div>
          {c.images?.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {c.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <button type="button" onClick={() => setShowReports((v) => !v)} style={{ ...btn(), justifySelf: "start", padding: "4px 0", border: 0 }}>
        {showReports ? "Hide" : "Show"} what reporters said
      </button>
      {showReports && (
        <div style={{ display: "grid", gap: 6 }}>
          {item.reports.map((r) => (
            <div key={r.id} style={{ fontSize: 13, color: C.muted }}>
              <strong style={{ color: C.text }}>@{r.by}</strong> · {REASON_LABEL[r.reason] || r.reason} · {when(r.at)}
              {r.details ? <div style={{ marginTop: 2 }}>“{r.details}”</div> : null}
              {r.resolution ? <div style={{ marginTop: 2 }}>Resolved: {r.resolution}</div> : null}
            </div>
          ))}
        </div>
      )}

      {error && <div role="alert" style={{ color: C.red, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn("ghost", !!busy)} disabled={!!busy} onClick={() => act("dismiss")}>
          {busy === "dismiss" ? "…" : c?.hidden ? "Dismiss & restore" : "Dismiss"}
        </button>
        {item.targetType !== "user" && !c?.deleted && (
          <button type="button" style={btn("danger", !!busy)} disabled={!!busy} onClick={() => act("remove")}>
            {busy === "remove" ? "…" : `Remove ${typeLabel.toLowerCase()}`}
          </button>
        )}
        {item.targetUser && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <select
              id={`days-${item.key}`}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 8px" }}
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="0">Until lifted</option>
            </select>
            <button type="button" style={btn("danger", !!busy)} disabled={!!busy} onClick={() => act("suspend")}>
              {busy === "suspend" ? "…" : item.targetType === "user" ? "Pause account" : "Remove & pause account"}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminSkyHub() {
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, s] = await Promise.all([
        api(`/api/skyhub/admin/reports?status=${status}`),
        api("/api/skyhub/admin/suspensions"),
      ]);
      setItems(r.items || []);
      setSuspensions(s.suspensions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const lift = async (userId) => {
    try {
      await api(`/api/skyhub/admin/suspensions/${userId}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "inherit" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 60px" }}>
        <Link to="/admin" style={{ color: C.muted, fontSize: 13 }}>← Admin dashboard</Link>
        <h1 style={{ fontSize: 26, margin: "8px 0 4px" }}>SkyHub reports</h1>
        <p style={{ color: C.muted, margin: "0 0 18px" }}>
          Posts and comments hide automatically after 3 different people report them, until you decide.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["open", "Needs review"],
            ["actioned", "Actioned"],
            ["dismissed", "Dismissed"],
          ].map(([v, l]) => (
            <button key={v} type="button" style={btn(status === v ? "primary" : "ghost")} onClick={() => setStatus(v)}>
              {l}
            </button>
          ))}
          <button type="button" style={btn()} onClick={load}>
            Refresh
          </button>
        </div>

        {error && <div role="alert" style={{ color: C.red, marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div style={{ color: C.muted }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, color: C.muted }}>
            {status === "open" ? "Nothing to review. SkyHub is quiet." : "Nothing here yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <ReportItem key={it.key} item={it} onDone={load} />
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 18, margin: "32px 0 10px" }}>Paused accounts</h2>
        {suspensions.length === 0 ? (
          <div style={{ color: C.muted }}>No one is paused.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {suspensions.map((s) => (
              <div
                key={s.userId}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {s.name} <span style={{ color: C.muted, fontWeight: 400 }}>@{s.username}</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 13 }}>
                    {s.until ? `Until ${when(s.until)}` : "Until lifted"}
                    {s.reason ? ` · ${s.reason}` : ""}
                    {s.by ? ` · by ${s.by}` : ""}
                  </div>
                </div>
                <button type="button" style={btn()} onClick={() => lift(s.userId)}>
                  Lift
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
