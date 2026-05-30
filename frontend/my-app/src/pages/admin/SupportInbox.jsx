/**
 * SupportInbox.jsx
 * ────────────────
 * Your private support ticket inbox — only you see this.
 * Lives at: /admin/support
 *
 * INSTALL — in App.jsx:
 *   import SupportInbox from "./pages/admin/SupportInbox";
 *   // inside your admin Routes:
 *   <Route path="/admin/support" element={<SupportInbox />} />
 *
 * Tickets are read from localStorage (written by SupportWidget.jsx).
 * AI draft reply uses Anthropic API — same key your app already uses.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "skyrio_support_tickets";

function loadTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

const STATUS = {
  open: { label: "Open", color: "#ff8a2a" },
  inprogress: { label: "In Progress", color: "#7c5cfc" },
  resolved: { label: "Resolved", color: "#22c55e" },
};

async function draftReply(ticket) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a warm, empathetic support agent for Skyrio — a modern AI-powered travel platform. 
Draft a SHORT, helpful reply to this customer issue (3–5 sentences max). 
Be genuine, not robotic. End with one clear next step or resolution.
Don't make up details you don't know.

Customer: ${ticket.name}
Category: ${ticket.category}
Message: ${ticket.message}

Reply with just the message body — no subject line, no greeting like "Dear".`,
        },
      ],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default function SupportInbox() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    setTickets(loadTickets());
  }, []);

  function updateTicket(id, patch) {
    const updated = tickets.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTickets(updated);
    saveTickets(updated);
  }

  function deleteTicket(id) {
    const updated = tickets.filter((t) => t.id !== id);
    setTickets(updated);
    saveTickets(updated);
    if (selected?.id === id) setSelected(null);
  }

  async function handleDraft() {
    if (!selected) return;
    setDrafting(true);
    const text = await draftReply(selected);
    updateTicket(selected.id, { reply: text, status: "inprogress" });
    setSelected((t) => ({ ...t, reply: text, status: "inprogress" }));
    setDrafting(false);
  }

  const filtered =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const openCount = tickets.filter((t) => t.status === "open").length;

  // Keep selected in sync with tickets state
  const ticket = selected
    ? tickets.find((t) => t.id === selected.id) || null
    : null;

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <button onClick={() => navigate("/admin/dashboard")} style={s.backBtn}>
          ← Admin Dashboard
        </button>
        <div style={s.topTitle}>
          Support Inbox
          {openCount > 0 && <span style={s.badge}>{openCount} open</span>}
        </div>
        <div style={{ fontSize: 13, color: "rgba(240,237,255,0.35)" }}>
          /admin/support
        </div>
      </div>

      <div style={s.body}>
        {/* ── Sidebar ── */}
        <div style={s.sidebar}>
          {/* Filter tabs */}
          <div style={s.filterRow}>
            {["all", "open", "inprogress", "resolved"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...s.filterBtn,
                  ...(filter === f ? s.filterBtnActive : {}),
                }}
              >
                {f === "all"
                  ? "All"
                  : f === "inprogress"
                  ? "In Progress"
                  : STATUS[f]?.label}
                {f === "open" && openCount > 0 && (
                  <span style={s.filterCount}>{openCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          <div style={s.list}>
            {filtered.length === 0 && (
              <div style={s.empty}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div>No tickets here</div>
              </div>
            )}
            {filtered.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  ...s.ticketRow,
                  ...(ticket?.id === t.id ? s.ticketRowActive : {}),
                }}
              >
                <div style={s.ticketTop}>
                  <span style={s.ticketName}>{t.name}</span>
                  <span
                    style={{ ...s.dot, background: STATUS[t.status]?.color }}
                  />
                </div>
                <div style={s.ticketCat}>{t.category}</div>
                <div style={s.ticketSnippet}>
                  {t.message.slice(0, 55)}
                  {t.message.length > 55 ? "…" : ""}
                </div>
                <div style={s.ticketDate}>
                  {new Date(t.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Detail panel ── */}
        <div style={s.detail}>
          {!ticket ? (
            <div style={s.noSelect}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
              <p style={{ color: "rgba(240,237,255,0.35)", fontSize: 15 }}>
                Select a ticket to view and reply
              </p>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div style={s.detailHead}>
                <div>
                  <h2 style={s.detailName}>{ticket.name}</h2>
                  <a href={`mailto:${ticket.email}`} style={s.detailEmail}>
                    {ticket.email}
                  </a>
                </div>
                <div style={s.statusRow}>
                  <select
                    value={ticket.status}
                    onChange={(e) =>
                      updateTicket(ticket.id, { status: e.target.value })
                    }
                    style={{
                      ...s.statusSelect,
                      borderColor: STATUS[ticket.status]?.color,
                      color: STATUS[ticket.status]?.color,
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="inprogress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Meta chips */}
              <div style={s.metaRow}>
                <span style={s.chip}>📂 {ticket.category}</span>
                <span style={s.chip}>
                  🕐{" "}
                  {new Date(ticket.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Message */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Customer message</div>
                <div style={s.messageBox}>{ticket.message}</div>
              </div>

              {/* Reply */}
              <div style={s.section}>
                <div style={s.sectionLabelRow}>
                  <span style={s.sectionLabel}>Your reply</span>
                  <button
                    onClick={handleDraft}
                    disabled={drafting}
                    style={s.draftBtn}
                  >
                    {drafting ? "Drafting…" : "✨ AI draft reply"}
                  </button>
                </div>
                <textarea
                  style={{ ...s.textarea, marginTop: 8 }}
                  value={ticket.reply}
                  onChange={(e) =>
                    updateTicket(ticket.id, { reply: e.target.value })
                  }
                  placeholder="Write your reply, or click AI draft reply above…"
                />
              </div>

              {/* Internal notes */}
              <div style={s.section}>
                <div style={s.sectionLabel}>
                  Internal notes (only you see this)
                </div>
                <textarea
                  style={{
                    ...s.textarea,
                    height: 72,
                    marginTop: 8,
                    opacity: 0.7,
                  }}
                  value={ticket.notes}
                  onChange={(e) =>
                    updateTicket(ticket.id, { notes: e.target.value })
                  }
                  placeholder="Private notes — not visible to the customer…"
                />
              </div>

              {/* Actions */}
              <div style={s.actionRow}>
                <a
                  href={`mailto:${
                    ticket.email
                  }?subject=Re: Your Skyrio Support Request&body=${encodeURIComponent(
                    ticket.reply
                  )}`}
                  style={s.btnPrimary}
                >
                  📧 Open in Mail
                </a>
                {ticket.status !== "resolved" && (
                  <button
                    onClick={() =>
                      updateTicket(ticket.id, { status: "resolved" })
                    }
                    style={s.btnResolve}
                  >
                    ✓ Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => deleteTicket(ticket.id)}
                  style={s.btnDelete}
                >
                  🗑 Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles (Skyrio dark theme) ───────────────────────────────────────────────
const s = {
  root: {
    minHeight: "100vh",
    background: "#09071a",
    color: "#f0edff",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#0d0b22",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  backBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "rgba(240,237,255,0.55)",
    padding: "7px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  topTitle: {
    fontWeight: 700,
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    background: "#ff8a2a",
    color: "#fff",
    borderRadius: 20,
    fontSize: 11,
    padding: "2px 10px",
    fontWeight: 700,
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    height: "calc(100vh - 57px)",
  },

  // Sidebar
  sidebar: {
    width: 300,
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    background: "#0d0b22",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    padding: "14px 12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  filterBtn: {
    padding: "5px 10px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "none",
    color: "rgba(240,237,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  filterBtnActive: {
    background: "rgba(255,138,42,0.15)",
    borderColor: "#ff8a2a",
    color: "#ff8a2a",
  },
  filterCount: {
    background: "#ff8a2a",
    color: "#fff",
    borderRadius: 10,
    fontSize: 10,
    padding: "0 5px",
  },
  list: {
    overflowY: "auto",
    flex: 1,
  },
  empty: {
    padding: 40,
    textAlign: "center",
    color: "rgba(240,237,255,0.25)",
    fontSize: 14,
  },
  ticketRow: {
    padding: "13px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    cursor: "pointer",
    transition: "background .12s",
  },
  ticketRowActive: {
    background: "rgba(255,138,42,0.08)",
    borderLeft: "3px solid #ff8a2a",
  },
  ticketTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  ticketName: { fontWeight: 700, fontSize: 14, color: "#f0edff" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  ticketCat: {
    fontSize: 11,
    color: "#ff8a2a",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: 3,
  },
  ticketSnippet: {
    fontSize: 13,
    color: "rgba(240,237,255,0.45)",
    lineHeight: 1.4,
  },
  ticketDate: { fontSize: 11, color: "rgba(240,237,255,0.25)", marginTop: 4 },

  // Detail panel
  detail: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px",
  },
  noSelect: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  detailName: {
    margin: "0 0 5px",
    fontSize: 22,
    fontWeight: 700,
    color: "#f0edff",
  },
  detailEmail: { color: "#7c5cfc", fontSize: 14, textDecoration: "none" },
  statusRow: { display: "flex", alignItems: "center", gap: 8 },
  statusSelect: {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid",
    background: "rgba(255,255,255,0.05)",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    outline: "none",
  },

  metaRow: { display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" },
  chip: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "4px 12px",
    fontSize: 13,
    color: "rgba(240,237,255,0.55)",
  },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "rgba(240,237,255,0.35)",
    marginBottom: 2,
  },
  sectionLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  messageBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "14px 16px",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#f0edff",
    whiteSpace: "pre-wrap",
    marginTop: 8,
  },
  textarea: {
    width: "100%",
    height: 130,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#f0edff",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    lineHeight: 1.6,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
  },

  draftBtn: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid rgba(124,92,252,0.35)",
    background: "rgba(124,92,252,0.12)",
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },

  actionRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 },
  btnPrimary: {
    display: "inline-block",
    padding: "11px 22px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "'DM Sans', sans-serif",
  },
  btnResolve: {
    padding: "11px 20px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.10)",
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  btnDelete: {
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "none",
    color: "rgba(240,237,255,0.3)",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};
