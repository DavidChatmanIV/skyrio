// src/pages/admin/AdminSkyHub.jsx
// Route: /admin/skyhub  (admin-only — the backend enforces it)
//
// SkyHub moderation: everything travelers reported, grouped so each post,
// comment or traveler appears once with all its reasons. Actions follow the
// strike ladder (warning → 24h → 7 days → 30 days → permanent), set in
// backend/services/skyhubModeration.js. Appeals and paused accounts have
// their own tabs.

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

const consequence = (days) =>
  days === null || days === undefined ? "permanent ban" : days === 0 ? "warning" : `${days}-day pause`;

const when = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function ReportItem({ item, onDone, readOnly }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [showReports, setShowReports] = useState(false);
  const [reason, setReason] = useState(item.topReason || "other");
  const [note, setNote] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);

  const act = async (action) => {
    setBusy(action);
    setError("");
    try {
      const out = await api("/api/skyhub/admin/resolve", {
        method: "POST",
        body: JSON.stringify({
          targetType: item.targetType,
          targetId: item.targetId,
          action,
          reason,
          note: note.trim() || undefined,
        }),
      });
      if (out.strike) {
        setResult(
          `Strike ${out.strike.strikeNumber} — ${consequence(out.strike.action === "ban" ? null : out.strike.days || 0)}. They've been emailed.`
        );
        setTimeout(() => onDone?.(), 1600);
      } else onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
      setConfirmBan(false);
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
          {item.targetUser && (
            <span style={{ color: item.activeStrikes ? C.amber : C.muted, fontSize: 12 }}>
              · {item.activeStrikes || 0} active strike{item.activeStrikes === 1 ? "" : "s"}
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
      {result && <div role="status" style={{ color: C.green, fontSize: 13 }}>{result}</div>}

      {!readOnly && !result && (
        <>
          {item.targetUser && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <label style={{ fontSize: 12, color: C.muted }}>
                Guideline broken
                <select
                  id={`reason-${item.key}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 8px" }}
                >
                  {Object.entries(REASON_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: C.muted }}>
                Note to the traveler (optional)
                <input
                  id={`note-${item.key}`}
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please don't post referral links"
                  style={{ display: "block", width: "100%", marginTop: 4, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 8px", fontFamily: "inherit" }}
                />
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={btn("ghost", !!busy)} disabled={!!busy} onClick={() => act("dismiss")}>
              {busy === "dismiss" ? "…" : c?.hidden ? "Not a problem — restore" : "Not a problem"}
            </button>
            {item.targetType !== "user" && !c?.deleted && (
              <button type="button" style={btn("ghost", !!busy)} disabled={!!busy} onClick={() => act("remove")}>
                {busy === "remove" ? "…" : "Remove only (no strike)"}
              </button>
            )}
            {item.targetUser && (
              <>
                <button type="button" style={btn("danger", !!busy)} disabled={!!busy} onClick={() => act("strike")}>
                  {busy === "strike" ? "…" : `${item.targetType === "user" ? "Strike" : "Remove + strike"} → ${consequence(item.next?.standard)}`}
                </button>
                <button
                  type="button"
                  style={{ ...btn("danger", !!busy), fontWeight: item.suggestSevere ? 800 : 600 }}
                  disabled={!!busy}
                  onClick={() => act("severe")}
                  title="For threats, hate speech, scams or sexual content — skips the warning"
                >
                  {busy === "severe" ? "…" : `Severe → ${consequence(item.next?.severe)}`}
                </button>
                {!confirmBan ? (
                  <button type="button" style={btn("ghost", !!busy)} disabled={!!busy} onClick={() => setConfirmBan(true)}>
                    Ban…
                  </button>
                ) : (
                  <button type="button" style={btn("danger", !!busy)} disabled={!!busy} onClick={() => act("ban")}>
                    {busy === "ban" ? "…" : "Confirm permanent ban"}
                  </button>
                )}
              </>
            )}
          </div>
          {item.suggestSevere && item.targetUser && (
            <div style={{ fontSize: 12, color: C.amber }}>Reported as {REASON_LABEL[item.topReason]?.toLowerCase()} — this is usually treated as severe.</div>
          )}
        </>
      )}
    </div>
  );
}

function AppealItem({ a, onDone, readOnly }) {
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const decide = async (approve) => {
    setBusy(approve ? "approve" : "deny");
    setError("");
    try {
      await api(`/api/skyhub/admin/appeals/${a.id}`, {
        method: "POST",
        body: JSON.stringify({ approve, response: response.trim() }),
      });
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>
          {a.user?.name} <span style={{ color: C.muted, fontWeight: 400 }}>@{a.user?.username}</span>
        </div>
        <div style={{ color: C.muted, fontSize: 12 }}>appealed {when(a.appeal?.at)}</div>
      </div>
      <div style={{ fontSize: 13, color: C.muted }}>
        Strike for <strong style={{ color: C.text }}>{REASON_LABEL[a.reason] || a.reason}</strong>
        {a.severity === "severe" ? " (severe)" : ""} · {a.action === "ban" ? "permanent ban" : a.action === "suspension" ? `${a.suspensionDays}-day pause` : "warning"} · {when(a.strikeAt)}
        {a.by ? ` · by ${a.by}` : ""}
      </div>
      {a.snippet && <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 10, whiteSpace: "pre-wrap" }}>“{a.snippet}”</div>}
      <div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Their appeal</div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.appeal?.message}</div>
      </div>
      {readOnly ? (
        <div style={{ fontSize: 13, color: C.muted }}>
          {a.appeal?.status === "approved" ? "Approved" : "Denied"} by {a.appeal?.resolvedBy} · {when(a.appeal?.resolvedAt)}
          {a.appeal?.response ? <div style={{ marginTop: 4 }}>“{a.appeal.response}”</div> : null}
        </div>
      ) : (
        <>
          <textarea
            id={`appeal-${a.id}`}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Reply to the traveler (included in their email)"
            style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontFamily: "inherit" }}
          />
          {error && <div role="alert" style={{ color: C.red, fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn("primary", !!busy)} disabled={!!busy} onClick={() => decide(true)}>
              {busy === "approve" ? "…" : "Approve — remove strike"}
            </button>
            <button type="button" style={btn("ghost", !!busy)} disabled={!!busy} onClick={() => decide(false)}>
              {busy === "deny" ? "…" : "Deny — keep strike"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminSkyHub() {
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [counts, setCounts] = useState({ reports: 0, appeals: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const isAppeals = status.startsWith("appeals");
      const appealStatus = status === "appeals" ? "pending" : status.replace("appeals-", "");
      const [r, s, c] = await Promise.all([
        isAppeals
          ? api(`/api/skyhub/admin/appeals?status=${appealStatus}`)
          : api(`/api/skyhub/admin/reports?status=${status}`),
        api("/api/skyhub/admin/suspensions"),
        api("/api/skyhub/admin/open-counts").catch(() => ({ reports: 0, appeals: 0 })),
      ]);
      if (isAppeals) {
        setAppeals(r.appeals || []);
        setItems([]);
      } else {
        setItems(r.items || []);
        setAppeals([]);
      }
      setSuspensions(s.suspensions || []);
      setCounts({ reports: c.reports || 0, appeals: c.appeals || 0 });
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
          Posts and comments hide automatically after 3 different people report them, until you decide. Strikes follow the
          ladder: warning → 24-hour pause → 7 days → 30 days → permanent. Severe violations skip the warning. Strikes expire after
          90 days.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["open", `Needs review${counts.reports ? ` (${counts.reports})` : ""}`],
            ["appeals", `Appeals${counts.appeals ? ` (${counts.appeals})` : ""}`],
            ["actioned", "Actioned"],
            ["dismissed", "Dismissed"],
            ["appeals-approved", "Approved appeals"],
            ["appeals-denied", "Denied appeals"],
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
        ) : status.startsWith("appeals") ? (
          appeals.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, color: C.muted }}>
              {status === "appeals" ? "No appeals waiting." : "Nothing here yet."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {appeals.map((a) => (
                <AppealItem key={a.id} a={a} onDone={load} readOnly={status !== "appeals"} />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, color: C.muted }}>
            {status === "open" ? "Nothing to review. SkyHub is quiet." : "Nothing here yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <ReportItem key={it.key} item={it} onDone={load} readOnly={status !== "open"} />
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
                    {s.until ? `Until ${when(s.until)}` : "Permanent"}
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
