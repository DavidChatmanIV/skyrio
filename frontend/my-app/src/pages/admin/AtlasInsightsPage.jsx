// src/pages/admin/AtlasInsightsPage.jsx
// Founder-only view of how Atlas is doing. Route: /admin/atlas (guard it like your growth metrics dashboard)
import { useEffect, useState } from "react";
import { atlasApi } from "@/components/Atlas/atlasApi";
import "@/styles/atlas-booking-card.css";

const REASON_LABEL = {
  wrong_info: "Wrong info",
  didnt_understand: "Didn't understand",
  bad_suggestions: "Bad suggestions",
  too_long: "Too long",
  too_many_questions: "Too many questions",
  too_slow: "Too slow",
  other: "Other",
};

export default function AtlasInsightsPage() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    atlasApi(`/api/atlas/feedback/insights?days=${days}`).then(({ ok, data }) =>
      setD(ok ? data : { error: data.message || "Admins only" })
    );
  }, [days]);

  async function reviewed(id) {
    await atlasApi(`/api/atlas/feedback/${id}/reviewed`, { method: "PATCH", body: {} });
    setD((x) => ({ ...x, toReview: x.toReview.filter((f) => f.id !== id) }));
  }

  return (
    <div className="alp">
      <h1 className="alp-title">Atlas insights</h1>
      <div className="afb-chips">
        {[7, 30, 90].map((n) => (
          <button key={n} className={`afb-chip ${days === n ? "on" : ""}`} onClick={() => setDays(n)}>
            {n} days
          </button>
        ))}
      </div>

      {!d ? (
        <p className="abc-hold">Loading…</p>
      ) : d.error ? (
        <p className="abc-msg">{d.error}</p>
      ) : (
        <>
          <div className="ain-stats">
            <div className="abc-card">
              <div className="ain-num">{d.satisfaction ?? "–"}{d.satisfaction != null && "%"}</div>
              <div className="abc-hold">Thumbs up ({d.up} up · {d.down} down)</div>
            </div>
            <div className="abc-card">
              <div className="ain-num">{d.proposals.bookingRate ?? "–"}{d.proposals.bookingRate != null && "%"}</div>
              <div className="abc-hold">Atlas proposals booked ({d.proposals.booked} of {d.proposals.total})</div>
            </div>
          </div>

          <div className="abc-card">
            <div className="abc-title">Why people tap thumbs down</div>
            {d.topComplaints.length ? (
              <ul className="ain-bars">
                {d.topComplaints.map((c) => {
                  const max = d.topComplaints[0].count;
                  return (
                    <li key={c.reason}>
                      <span>{REASON_LABEL[c.reason] || c.reason}</span>
                      <span className="ain-bar"><span style={{ width: `${(c.count / max) * 100}%` }} /></span>
                      <strong>{c.count}</strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="abc-hold">No complaints yet.</p>
            )}
          </div>

          <div className="abc-card">
            <div className="abc-title">Proposals that didn't book</div>
            <ul className="abc-lines">
              <li>Expired before tapping: {d.proposals.expired}</li>
              <li>Price changed: {d.proposals.priceChanged}</li>
              <li>Failed: {d.proposals.failed}</li>
            </ul>
          </div>

          <h2 className="alp-h2">Thumbs-down to review</h2>
          {!d.toReview.length && <p className="abc-hold">All caught up.</p>}
          {d.toReview.map((f) => (
            <div key={f.id} className="abc-card">
              <div className="alp-meta">
                {new Date(f.createdAt).toLocaleString()} · {(f.reasons || []).map((r) => REASON_LABEL[r]).join(", ") || "No reason given"}
                {f.toolsUsed?.length ? ` · ${f.toolsUsed.join(", ")}` : ""}
              </div>
              {f.comment && <p className="ain-comment">"{f.comment}"</p>}
              {f.atlasReply && <p className="ain-reply">{f.atlasReply}</p>}
              <button className="apc-link" onClick={() => reviewed(f.id)}>Mark reviewed</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
