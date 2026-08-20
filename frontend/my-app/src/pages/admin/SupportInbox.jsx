import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Select, message } from "antd";
import { apiUrl } from "@/lib/api";

// ─── Design tokens — matches AdminDashboard.jsx ────────────────────────────
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
  .sk-inbox * { box-sizing: border-box; }
  .sk-inbox { min-height: 100vh; background: ${C.bg}; color: ${C.white}; font-family: "DM Sans", sans-serif; }
  .sk-inbox__topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid ${C.border};
    position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
  }
  .sk-inbox__logo { font-family: "Syne", sans-serif; font-size: 16px; font-weight: 800; color: ${C.white}; display: flex; align-items: center; gap: 8px; }
  .sk-inbox__topbtn { background: none; border: 1px solid ${C.border}; color: ${C.muted}; padding: 6px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; transition: border-color .2s, color .2s; }
  .sk-inbox__topbtn:hover { border-color: ${C.orange}; color: ${C.orange}; }
  .sk-inbox__body { padding: 32px; max-width: 1000px; margin: 0 auto; }

  .sk-inbox__tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .sk-inbox__tab {
    background: none; border: 1px solid ${C.border}; color: ${C.muted};
    padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all .15s;
  }
  .sk-inbox__tab--active { border-color: ${C.orange}; color: ${C.orange}; background: ${C.orangeDim}; }

  .sk-inbox__filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .sk-inbox__filter-btn {
    background: none; border: 1px solid ${C.border}; color: ${C.muted};
    padding: 5px 14px; border-radius: 999px; font-size: 12px; cursor: pointer;
    font-family: inherit; transition: all .15s;
  }
  .sk-inbox__filter-btn--active { border-color: ${C.purple}; color: ${C.purple}; background: ${C.purpleDim}; }

  .sk-inbox__card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 20px; margin-bottom: 14px; }
  .sk-inbox__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .sk-inbox__name { font-size: 14px; font-weight: 700; color: ${C.white}; }
  .sk-inbox__email { font-size: 12px; color: ${C.muted}; margin-top: 2px; }
  .sk-inbox__time { font-size: 11px; color: ${C.muted}; white-space: nowrap; }
  .sk-inbox__message { font-size: 13.5px; color: rgba(255,255,255,0.8); line-height: 1.55; margin: 10px 0; white-space: pre-wrap; }
  .sk-inbox__meta-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  .sk-inbox__pill { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 3px 10px; }
  .sk-inbox__stars { color: ${C.orange}; font-size: 13px; letter-spacing: 1px; }
  .sk-inbox__empty { padding: 60px 20px; text-align: center; font-size: 13px; color: ${C.muted}; }
  .sk-inbox__spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${C.orange}; animation: sk-spin 0.7s linear infinite; display: inline-block; }
  @keyframes sk-spin { to { transform: rotate(360deg); } }

  .sk-inbox .ant-select-selector { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.15) !important; }
  .sk-inbox .ant-select-selection-item { color: #fff !important; }
`;

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SUPPORT_STATUSES = [
  { value: "open", label: "Open", color: C.orange, bg: C.orangeDim },
  { value: "in_progress", label: "In progress", color: C.blue, bg: C.blueDim },
  { value: "resolved", label: "Resolved", color: C.green, bg: C.greenDim },
  { value: "closed", label: "Closed", color: C.muted, bg: C.card },
];

const FEEDBACK_STATUSES = [
  { value: "new", label: "New", color: C.orange, bg: C.orangeDim },
  { value: "reviewed", label: "Reviewed", color: C.blue, bg: C.blueDim },
  { value: "actioned", label: "Actioned", color: C.green, bg: C.greenDim },
  { value: "dismissed", label: "Dismissed", color: C.muted, bg: C.card },
];

function StatusPill({ status, options }) {
  const s = options.find((o) => o.value === status) || options[0];
  return (
    <span
      className="sk-inbox__pill"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

export default function AdminSupportInbox() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("support"); // "support" | "feedback"
  const [statusFilter, setStatusFilter] = useState("all");

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  const adminHeaders = () => ({
    "x-admin-email": localStorage.getItem("admin_email") || "",
  });

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/support?limit=100"), {
        credentials: "include",
        headers: adminHeaders(),
      });
      if (res.status === 401) {
        navigate("/admin/login");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json.ok) setTickets(json.tickets || []);
    } catch {
      message.error("Could not load support tickets.");
    }
    setTicketsLoading(false);
  }, [navigate]);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const res = await fetch(apiUrl("/api/feedback?limit=100"), {
        credentials: "include",
        headers: adminHeaders(),
      });
      if (res.status === 401) {
        navigate("/admin/login");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json.ok) setFeedback(json.feedback || []);
    } catch {
      message.error("Could not load feedback.");
    }
    setFeedbackLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchTickets();
    fetchFeedback();
  }, [fetchTickets, fetchFeedback]);

  const updateTicketStatus = async (id, status) => {
    try {
      const res = await fetch(apiUrl(`/api/support/${id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.message || "Failed to update");
      setTickets((prev) =>
        prev.map((t) => (t._id === id ? { ...t, status } : t))
      );
      message.success("Ticket updated.");
    } catch (err) {
      message.error(err.message || "Failed to update ticket.");
    }
  };

  const updateFeedbackStatus = async (id, status) => {
    try {
      const res = await fetch(apiUrl(`/api/feedback/${id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.message || "Failed to update");
      setFeedback((prev) =>
        prev.map((f) => (f._id === id ? { ...f, status } : f))
      );
      message.success("Feedback updated.");
    } catch (err) {
      message.error(err.message || "Failed to update feedback.");
    }
  };

  const visibleTickets =
    statusFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === statusFilter);
  const visibleFeedback =
    statusFilter === "all"
      ? feedback
      : feedback.filter((f) => f.status === statusFilter);

  const activeStatuses =
    tab === "support" ? SUPPORT_STATUSES : FEEDBACK_STATUSES;

  return (
    <div className="sk-inbox">
      <style>{INJECTED_CSS}</style>

      <div className="sk-inbox__topbar">
        <div className="sk-inbox__logo">
          ✦ Skyrio{" "}
          <span style={{ color: C.muted, fontWeight: 500 }}>
            · Support Inbox
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="sk-inbox__topbtn"
            onClick={() => {
              fetchTickets();
              fetchFeedback();
            }}
          >
            ↻ Refresh
          </button>
          <button
            className="sk-inbox__topbtn"
            onClick={() => navigate("/admin")}
          >
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="sk-inbox__body">
        <div className="sk-inbox__tabs">
          <button
            className={`sk-inbox__tab ${
              tab === "support" ? "sk-inbox__tab--active" : ""
            }`}
            onClick={() => {
              setTab("support");
              setStatusFilter("all");
            }}
          >
            🛟 Support Tickets ({tickets.length})
          </button>
          <button
            className={`sk-inbox__tab ${
              tab === "feedback" ? "sk-inbox__tab--active" : ""
            }`}
            onClick={() => {
              setTab("feedback");
              setStatusFilter("all");
            }}
          >
            💬 Feedback ({feedback.length})
          </button>
        </div>

        <div className="sk-inbox__filters">
          <button
            className={`sk-inbox__filter-btn ${
              statusFilter === "all" ? "sk-inbox__filter-btn--active" : ""
            }`}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          {activeStatuses.map((s) => (
            <button
              key={s.value}
              className={`sk-inbox__filter-btn ${
                statusFilter === s.value ? "sk-inbox__filter-btn--active" : ""
              }`}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Support tickets ── */}
        {tab === "support" && (
          <>
            {ticketsLoading && (
              <div className="sk-inbox__empty">
                <span className="sk-inbox__spinner" />
              </div>
            )}
            {!ticketsLoading && visibleTickets.length === 0 && (
              <div className="sk-inbox__empty">No support tickets here.</div>
            )}
            {visibleTickets.map((t) => (
              <div key={t._id} className="sk-inbox__card">
                <div className="sk-inbox__card-head">
                  <div>
                    <div className="sk-inbox__name">{t.name}</div>
                    <div className="sk-inbox__email">{t.email}</div>
                  </div>
                  <div className="sk-inbox__time">{timeAgo(t.createdAt)}</div>
                </div>

                <div className="sk-inbox__message">{t.message}</div>

                <div className="sk-inbox__meta-row">
                  <StatusPill status={t.status} options={SUPPORT_STATUSES} />
                  <span
                    className="sk-inbox__pill"
                    style={{ background: C.purpleDim, color: C.purple }}
                  >
                    {t.category}
                  </span>
                  {t.page && (
                    <span style={{ fontSize: 11, color: C.muted }}>
                      on {t.page}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto" }}>
                    <Select
                      size="small"
                      value={t.status}
                      style={{ width: 140 }}
                      onChange={(val) => updateTicketStatus(t._id, val)}
                      options={SUPPORT_STATUSES.map((s) => ({
                        value: s.value,
                        label: s.label,
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Feedback ── */}
        {tab === "feedback" && (
          <>
            {feedbackLoading && (
              <div className="sk-inbox__empty">
                <span className="sk-inbox__spinner" />
              </div>
            )}
            {!feedbackLoading && visibleFeedback.length === 0 && (
              <div className="sk-inbox__empty">No feedback here.</div>
            )}
            {visibleFeedback.map((f) => (
              <div key={f._id} className="sk-inbox__card">
                <div className="sk-inbox__card-head">
                  <div>
                    <div className="sk-inbox__name">
                      {f.userId?.username || f.userId?.email || "Anonymous"}
                    </div>
                    {f.rating ? (
                      <div className="sk-inbox__stars">
                        {"★".repeat(f.rating)}
                        {"☆".repeat(5 - f.rating)}
                      </div>
                    ) : null}
                  </div>
                  <div className="sk-inbox__time">{timeAgo(f.createdAt)}</div>
                </div>

                <div className="sk-inbox__message">{f.message}</div>

                <div className="sk-inbox__meta-row">
                  <StatusPill status={f.status} options={FEEDBACK_STATUSES} />
                  {f.page && (
                    <span style={{ fontSize: 11, color: C.muted }}>
                      on {f.page}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto" }}>
                    <Select
                      size="small"
                      value={f.status}
                      style={{ width: 140 }}
                      onChange={(val) => updateFeedbackStatus(f._id, val)}
                      options={FEEDBACK_STATUSES.map((s) => ({
                        value: s.value,
                        label: s.label,
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
