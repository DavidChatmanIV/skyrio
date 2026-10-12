// SkyHubStanding.jsx
// Shows a traveler their SkyHub account standing: any active strikes, a
// pause if they have one, and a way to appeal. Renders nothing when the
// account is in good standing (unless opened from a strike email link).

import React, { useCallback, useEffect, useState } from "react";
import { Button, Input, Modal, message } from "antd";
import { Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";


/* skyhub-login */
const skyAuthFetch = (url, opts = {}) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    credentials: "include",
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
};

function skyFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  return skyAuthFetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

const fmt = (d, withTime = false) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      })
    : "";

const ACTION_TEXT = (s) =>
  s.action === "ban" ? "Permanent suspension" : s.action === "suspension" ? `${s.suspensionDays}-day pause` : "Warning";

export default function SkyHubStanding({ signedIn }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [appealing, setAppealing] = useState(null);
  const [appealText, setAppealText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await skyFetch("/api/skyhub/me/standing");
      const d = await res.json();
      if (res.ok) setData(d);
    } catch {
      /* standing is optional UI */
    }
  }, [signedIn]);

  useEffect(() => {
    load();
  }, [load]);

  // Strike emails link to /skyhub?standing=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("standing") === "1") setOpen(true);
  }, []);

  if (!signedIn || !data) return null;
  const { paused, activeStrikes, strikes } = data;
  const show = paused || activeStrikes > 0;

  const sendAppeal = async () => {
    setSending(true);
    try {
      const res = await skyFetch(`/api/skyhub/strikes/${appealing.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: appealText.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Couldn't send your appeal.");
      message.success(d.message || "Appeal sent.");
      setAppealing(null);
      setAppealText("");
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const tone = paused ? { bg: "rgba(248,113,113,0.1)", line: "rgba(248,113,113,0.35)", fg: "#fca5a5" } : { bg: "rgba(251,191,36,0.1)", line: "rgba(251,191,36,0.35)", fg: "#fbbf24" };

  return (
    <>
      {show && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 16px",
            borderRadius: 14,
            background: tone.bg,
            border: `1px solid ${tone.line}`,
            color: "#fff",
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: tone.fg }}>
              {paused
                ? paused.permanent
                  ? "Your SkyHub account is suspended"
                  : `SkyHub is paused for you until ${fmt(paused.until, true)}`
                : `You have ${activeStrikes} active strike${activeStrikes === 1 ? "" : "s"}`}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
              {paused
                ? "You can still read SkyHub, search and book trips."
                : "Strikes expire after 90 days. More strikes lead to longer pauses."}
            </div>
          </div>
          <Button onClick={() => setOpen(true)}>See details</Button>
        </div>
      )}

      <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Your SkyHub account standing" width={560}>
        {!show && strikes.length === 0 ? (
          <p>You're in good standing — no strikes. Thanks for helping keep SkyHub friendly.</p>
        ) : (
          <>
            {paused && (
              <p style={{ fontWeight: 600 }}>
                {paused.permanent ? "Your SkyHub account is permanently suspended." : `Paused until ${fmt(paused.until, true)}.`} You can
                still search and book trips.
              </p>
            )}
            <p style={{ opacity: 0.75 }}>
              Active strikes: <strong>{activeStrikes}</strong>. Each strike lasts 90 days. The next ones lead to: 24-hour pause, 7 days, 30
              days, then a permanent suspension.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {strikes.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: "1px solid rgba(127,127,127,0.25)",
                    borderRadius: 12,
                    padding: 12,
                    opacity: s.active ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{s.reasonLabel}</strong>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{fmt(s.at)}</span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    {ACTION_TEXT(s)}
                    {s.severity === "severe" ? " · serious violation" : ""}
                    {s.voided ? " · removed on appeal" : s.active ? ` · expires ${fmt(s.expiresAt)}` : " · expired"}
                  </div>
                  {s.snippet && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>“{s.snippet}”</div>}
                  {s.note && <div style={{ fontSize: 13, marginTop: 6 }}>Note from Skyrio: {s.note}</div>}
                  {s.appeal.status === "pending" && <div style={{ fontSize: 13, marginTop: 6, color: "#d9620f" }}>Appeal under review</div>}
                  {s.appeal.status === "denied" && (
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      Appeal denied{s.appeal.response ? `: ${s.appeal.response}` : ""}
                    </div>
                  )}
                  {s.canAppeal &&
                    (appealing?.id === s.id ? (
                      <div style={{ marginTop: 8 }}>
                        <Input.TextArea
                          id={`appeal-text-${s.id}`}
                          value={appealText}
                          onChange={(e) => setAppealText(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          placeholder="Tell us why you think this was a mistake."
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Button type="primary" loading={sending} disabled={appealText.trim().length < 10} onClick={sendAppeal}>
                            Send appeal
                          </Button>
                          <Button onClick={() => setAppealing(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="small" style={{ marginTop: 8 }} onClick={() => setAppealing(s)}>
                        Appeal this
                      </Button>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}
        <p style={{ marginTop: 14, fontSize: 13 }}>
          <Link to="/skyhub/guidelines" onClick={() => setOpen(false)}>
            Read the community guidelines
          </Link>
        </p>
      </Modal>
    </>
  );
}
