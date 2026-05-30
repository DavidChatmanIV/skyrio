import { useState, useEffect } from "react";

// ─── Minimal persistent storage via window.storage ───────────────────────────
const STORAGE_KEY = "support-tickets";

async function loadTickets() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}

async function saveTickets(tickets) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(tickets));
  } catch {}
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  open: { label: "Open", color: "#f97316" },
  inprogress: { label: "In Progress", color: "#3b82f6" },
  resolved: { label: "Resolved", color: "#22c55e" },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── AI reply draft via Anthropic API ─────────────────────────────────────────
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
          content: `You are a friendly, empathetic customer support agent for a startup. 
Draft a SHORT, warm reply to this customer issue. Be concise (3–5 sentences max). 
Don't make up specifics you don't know. End with a clear next step.

Customer name: ${ticket.name}
Issue category: ${ticket.category}
Their message: ${ticket.message}

Reply only with the email/message body — no subject line, no "Dear", just the body.`,
        },
      ],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ─── CUSTOMER SUBMISSION FORM ─────────────────────────────────────────────────
function SubmitForm({ onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "billing",
    message: "",
  });
  const [sent, setSent] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    onSubmit({
      ...form,
      id: uid(),
      status: "open",
      createdAt: new Date().toISOString(),
      notes: "",
      reply: "",
    });
    setSent(true);
  }

  if (sent)
    return (
      <div style={styles.sentBox}>
        <div style={styles.sentIcon}>✓</div>
        <h2 style={styles.sentTitle}>Got it — we'll be in touch soon.</h2>
        <p style={styles.sentSub}>
          A real human will review your issue and reply within 24 hours.
        </p>
        <button style={styles.btnSecondary} onClick={() => setSent(false)}>
          Submit another issue
        </button>
      </div>
    );

  return (
    <div style={styles.formWrap}>
      <div style={styles.formHeader}>
        <span style={styles.badge}>🤖 AI couldn't help?</span>
        <h1 style={styles.formTitle}>Talk to a human.</h1>
        <p style={styles.formSub}>
          Fill out the form and we'll personally get back to you.
        </p>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Your name</label>
        <input
          style={styles.input}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Jane Smith"
        />
      </div>
      <div style={styles.field}>
        <label style={styles.label}>Email address</label>
        <input
          style={styles.input}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="jane@example.com"
          type="email"
        />
      </div>
      <div style={styles.field}>
        <label style={styles.label}>Category</label>
        <select
          style={styles.input}
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="billing">Billing & Payments</option>
          <option value="technical">Technical Issue</option>
          <option value="account">Account Access</option>
          <option value="feature">Feature Request</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={styles.field}>
        <label style={styles.label}>Describe your issue</label>
        <textarea
          style={{ ...styles.input, height: 120, resize: "vertical" }}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Tell us exactly what went wrong and what you expected to happen…"
        />
      </div>

      <button style={styles.btnPrimary} onClick={handleSubmit}>
        Send to support team →
      </button>
    </div>
  );
}

// ─── OWNER INBOX ──────────────────────────────────────────────────────────────
function Inbox({ tickets, onUpdate }) {
  const [selected, setSelected] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const ticket = tickets.find((t) => t.id === selected) || null;

  const filtered =
    filterStatus === "all"
      ? tickets
      : tickets.filter((t) => t.status === filterStatus);

  async function handleDraft() {
    if (!ticket) return;
    setDrafting(true);
    const text = await draftReply(ticket);
    onUpdate(ticket.id, { reply: text, status: "inprogress" });
    setDrafting(false);
  }

  function handleResolve() {
    if (!ticket) return;
    onUpdate(ticket.id, { status: "resolved" });
  }

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div style={styles.inbox}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Support Inbox</h2>
          {openCount > 0 && <span style={styles.countBadge}>{openCount}</span>}
        </div>

        <div style={styles.filterRow}>
          {["all", "open", "inprogress", "resolved"].map((s) => (
            <button
              key={s}
              style={{
                ...styles.filterBtn,
                ...(filterStatus === s ? styles.filterBtnActive : {}),
              }}
              onClick={() => setFilterStatus(s)}
            >
              {s === "all" ? "All" : STATUS[s]?.label}
            </button>
          ))}
        </div>

        <div style={styles.ticketList}>
          {filtered.length === 0 && (
            <div style={styles.emptyList}>No tickets yet 🎉</div>
          )}
          {filtered.map((t) => (
            <div
              key={t.id}
              style={{
                ...styles.ticketRow,
                ...(selected === t.id ? styles.ticketRowActive : {}),
              }}
              onClick={() => setSelected(t.id)}
            >
              <div style={styles.ticketRowTop}>
                <span style={styles.ticketName}>{t.name}</span>
                <span
                  style={{ ...styles.dot, background: STATUS[t.status]?.color }}
                />
              </div>
              <div style={styles.ticketCategory}>{t.category}</div>
              <div style={styles.ticketSnippet}>{t.message.slice(0, 60)}…</div>
              <div style={styles.ticketDate}>
                {new Date(t.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div style={styles.detail}>
        {!ticket ? (
          <div style={styles.noSelect}>
            <div style={styles.noSelectIcon}>📬</div>
            <p style={styles.noSelectText}>Select a ticket to view details</p>
          </div>
        ) : (
          <>
            <div style={styles.detailHeader}>
              <div>
                <h3 style={styles.detailName}>{ticket.name}</h3>
                <a href={`mailto:${ticket.email}`} style={styles.detailEmail}>
                  {ticket.email}
                </a>
              </div>
              <div style={styles.statusPill}>
                <span
                  style={{
                    ...styles.statusDot,
                    background: STATUS[ticket.status]?.color,
                  }}
                />
                {STATUS[ticket.status]?.label}
              </div>
            </div>

            <div style={styles.detailMeta}>
              <span style={styles.metaChip}>📂 {ticket.category}</span>
              <span style={styles.metaChip}>
                🕐 {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionLabel}>Customer message</div>
              <div style={styles.messageBox}>{ticket.message}</div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionLabelRow}>
                <span style={styles.sectionLabel}>Your reply</span>
                <button
                  style={styles.btnDraft}
                  onClick={handleDraft}
                  disabled={drafting}
                >
                  {drafting ? "Drafting…" : "✨ AI draft reply"}
                </button>
              </div>
              <textarea
                style={{
                  ...styles.input,
                  height: 140,
                  resize: "vertical",
                  marginTop: 8,
                }}
                value={ticket.reply}
                onChange={(e) => onUpdate(ticket.id, { reply: e.target.value })}
                placeholder="Write your reply here, or click AI draft reply above…"
              />
            </div>

            <div style={styles.section}>
              <div style={styles.sectionLabel}>Internal notes</div>
              <textarea
                style={{
                  ...styles.input,
                  height: 72,
                  resize: "vertical",
                  marginTop: 8,
                  opacity: 0.85,
                }}
                value={ticket.notes}
                onChange={(e) => onUpdate(ticket.id, { notes: e.target.value })}
                placeholder="Private notes — not visible to the customer…"
              />
            </div>

            <div style={styles.actionRow}>
              <a
                href={`mailto:${ticket.email}?body=${encodeURIComponent(
                  ticket.reply
                )}`}
                style={styles.btnPrimary}
              >
                📧 Open in Mail
              </a>
              {ticket.status !== "resolved" && (
                <button style={styles.btnResolve} onClick={handleResolve}>
                  Mark resolved ✓
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("form"); // "form" | "inbox"
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTickets().then((t) => {
      setTickets(t);
      setLoaded(true);
    });
  }, []);

  async function addTicket(t) {
    const next = [t, ...tickets];
    setTickets(next);
    await saveTickets(next);
  }

  async function updateTicket(id, patch) {
    const next = tickets.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTickets(next);
    await saveTickets(next);
  }

  if (!loaded) return <div style={styles.loading}>Loading…</div>;

  return (
    <div style={styles.root}>
      {/* Top nav */}
      <nav style={styles.nav}>
        <div style={styles.navBrand}>⚡ SupportDesk</div>
        <div style={styles.navTabs}>
          <button
            style={{
              ...styles.navTab,
              ...(view === "form" ? styles.navTabActive : {}),
            }}
            onClick={() => setView("form")}
          >
            Customer Form
          </button>
          <button
            style={{
              ...styles.navTab,
              ...(view === "inbox" ? styles.navTabActive : {}),
            }}
            onClick={() => setView("inbox")}
          >
            My Inbox
            {tickets.filter((t) => t.status === "open").length > 0 && (
              <span style={styles.navBadge}>
                {tickets.filter((t) => t.status === "open").length}
              </span>
            )}
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {view === "form" ? (
          <SubmitForm onSubmit={addTicket} />
        ) : (
          <Inbox tickets={tickets} onUpdate={updateTicket} />
        )}
      </main>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    fontFamily: "'Georgia', serif",
    background: "#faf9f7",
    minHeight: "100vh",
    color: "#1a1a1a",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontSize: 18,
    color: "#888",
  },

  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 28px",
    background: "#fff",
    borderBottom: "1px solid #e5e5e5",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  navBrand: { fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" },
  navTabs: { display: "flex", gap: 4 },
  navTab: {
    padding: "7px 18px",
    border: "1px solid transparent",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    background: "none",
    color: "#555",
    fontFamily: "inherit",
    position: "relative",
  },
  navTabActive: {
    background: "#1a1a1a",
    color: "#fff",
    borderColor: "#1a1a1a",
  },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    background: "#f97316",
    color: "#fff",
    borderRadius: 10,
    fontSize: 10,
    padding: "1px 5px",
    fontFamily: "sans-serif",
  },

  main: { maxWidth: 1100, margin: "0 auto", padding: "32px 20px" },

  // Form
  formWrap: { maxWidth: 520, margin: "0 auto" },
  formHeader: { marginBottom: 28 },
  badge: {
    display: "inline-block",
    background: "#fff3cd",
    border: "1px solid #fcd34d",
    borderRadius: 20,
    padding: "3px 12px",
    fontSize: 13,
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: 700,
    margin: "6px 0 8px",
    letterSpacing: "-1px",
  },
  formSub: { color: "#666", fontSize: 15, margin: 0 },

  field: { marginBottom: 18 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 15,
    fontFamily: "inherit",
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color .15s",
  },

  btnPrimary: {
    display: "inline-block",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
  },
  btnSecondary: {
    background: "none",
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnDraft: {
    background: "#f0f4ff",
    border: "1px solid #c7d4f7",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    color: "#3b5bdb",
    fontWeight: 600,
  },
  btnResolve: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 8,
    padding: "11px 20px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    color: "#16a34a",
    fontWeight: 600,
  },

  sentBox: { textAlign: "center", paddingTop: 80 },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#22c55e",
    color: "#fff",
    fontSize: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  sentTitle: { fontSize: 24, fontWeight: 700, margin: "0 0 10px" },
  sentSub: { color: "#666", marginBottom: 24 },

  // Inbox
  inbox: {
    display: "flex",
    gap: 0,
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    minHeight: 560,
  },

  sidebar: {
    width: 280,
    borderRight: "1px solid #e5e5e5",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "16px 16px 8px",
  },
  sidebarTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
  countBadge: {
    background: "#f97316",
    color: "#fff",
    borderRadius: 10,
    fontSize: 11,
    padding: "2px 7px",
    fontFamily: "sans-serif",
  },

  filterRow: {
    display: "flex",
    gap: 4,
    padding: "4px 12px 12px",
    flexWrap: "wrap",
  },
  filterBtn: {
    padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid #e0e0e0",
    background: "none",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterBtnActive: {
    background: "#1a1a1a",
    color: "#fff",
    borderColor: "#1a1a1a",
  },

  ticketList: { overflowY: "auto", flex: 1 },
  emptyList: { padding: 24, textAlign: "center", color: "#aaa", fontSize: 14 },
  ticketRow: {
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    transition: "background .1s",
  },
  ticketRowActive: { background: "#f5f5f5" },
  ticketRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  ticketName: { fontWeight: 600, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  ticketCategory: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 3,
  },
  ticketSnippet: { fontSize: 13, color: "#555", lineHeight: 1.4 },
  ticketDate: { fontSize: 11, color: "#bbb", marginTop: 4 },

  detail: { flex: 1, padding: 28, overflowY: "auto" },
  noSelect: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#aaa",
  },
  noSelectIcon: { fontSize: 40, marginBottom: 12 },
  noSelectText: { fontSize: 15 },

  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  detailName: { margin: "0 0 4px", fontSize: 20, fontWeight: 700 },
  detailEmail: { color: "#3b82f6", fontSize: 14, textDecoration: "none" },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#f5f5f5",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },

  detailMeta: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  metaChip: {
    background: "#f5f5f5",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    color: "#555",
  },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: "#888",
    marginBottom: 2,
  },
  sectionLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  messageBox: {
    background: "#faf9f7",
    border: "1px solid #ebebeb",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 15,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },

  actionRow: { display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" },
};
