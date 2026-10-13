import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/styles/SkyHubPage.css";
import { apiUrl } from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
   /skyhub/report-content — formal removal requests.
   Works WITHOUT a Skyrio account (required by the TAKE IT DOWN Act).
   • Intimate image shared without consent → hidden right away, 48h
   • Copyright (DMCA)
   • Check the status of a request with its tracking number
───────────────────────────────────────────────────────────── */

const KINDS = [
  {
    value: "intimate",
    label: "An intimate image of me",
    sub: "Shared without my consent, real or AI-made",
  },
  {
    value: "copyright",
    label: "My copyrighted work",
    sub: "Photo, video or text I own",
  },
  {
    value: "status",
    label: "Check a request",
    sub: "Use your tracking number",
  },
];

async function send(path, opts) {
  const token = localStorage.getItem("token");
  const r = await fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

const STATUS_TEXT = {
  received: "Received, being reviewed",
  removed: "Content removed",
  rejected: "Not removed",
  restored: "Restored after a counter-notice",
};

export default function SkyHubTakedownRequest() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [kind, setKind] = useState(
    params.get("kind") === "copyright" ? "copyright" : "intimate"
  );
  const [f, setF] = useState({
    name: "",
    email: "",
    relationship: "self",
    contentLinks: params.get("post") || "",
    description: "",
    copyrightedWork: "",
    signature: "",
    goodFaith: false,
    accuracyUnderPenalty: false,
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState({ ticket: "", email: "" });
  const [status, setStatus] = useState(null);

  const set = (k) => (e) =>
    setF((s) => ({
      ...s,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      setDone(
        await send("/api/skyhub/takedown", {
          method: "POST",
          body: JSON.stringify({ ...f, kind }),
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const check = async (e) => {
    e.preventDefault();
    setError("");
    setStatus(null);
    try {
      setStatus(
        await send(
          `/api/skyhub/takedown/${encodeURIComponent(
            lookup.ticket.trim()
          )}?email=${encodeURIComponent(lookup.email.trim())}`,
          { method: "GET" }
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="skyhub-page shReq">
      <div className="shReq__wrap">
        <button
          type="button"
          className="shReq__back"
          onClick={() => navigate("/skyhub")}
        >
          ← Back to SkyHub
        </button>
        <h1 className="shReq__title">Request removal of content</h1>
        <p className="shReq__lead">
          You don't need a Skyrio account to use this form. Every request gets a
          tracking number, and we'll tell you what we decided.
        </p>

        <div className="shReq__kinds" role="tablist">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="tab"
              aria-selected={kind === k.value}
              className={`shReq__kind${kind === k.value ? " is-on" : ""}`}
              onClick={() => {
                setKind(k.value);
                setDone(null);
                setError("");
              }}
            >
              <strong>{k.label}</strong>
              <span>{k.sub}</span>
            </button>
          ))}
        </div>

        {kind === "status" ? (
          <form className="shReq__card" onSubmit={check}>
            <label className="shReq__field">
              Tracking number
              <input
                value={lookup.ticket}
                onChange={(e) =>
                  setLookup((s) => ({ ...s, ticket: e.target.value }))
                }
                placeholder="SKY-XXXXXX"
                required
              />
            </label>
            <label className="shReq__field">
              Email you used
              <input
                type="email"
                value={lookup.email}
                onChange={(e) =>
                  setLookup((s) => ({ ...s, email: e.target.value }))
                }
                required
              />
            </label>
            {error && <div className="shReq__error">{error}</div>}
            <button className="shReq__submit" type="submit">
              Check status
            </button>
            {status && (
              <div className="shReq__status">
                <div className="shReq__statusRow">
                  <span>{status.ticket}</span>
                  <b className={`is-${status.status}`}>
                    {STATUS_TEXT[status.status] || status.status}
                  </b>
                </div>
                <div className="shReq__muted">
                  Received {new Date(status.receivedAt).toLocaleString()}
                </div>
                {status.decisionNote && <p>{status.decisionNote}</p>}
              </div>
            )}
          </form>
        ) : done ? (
          <div className="shReq__card shReq__done">
            <div className="shReq__stamp">✓</div>
            <h2>We've got your request</h2>
            <p>{done.message}</p>
            <div className="shReq__ticket">
              Tracking number <b>{done.ticket}</b>
            </div>
            <p className="shReq__muted">
              Save this number. You can check its status on this page anytime.
            </p>
          </div>
        ) : (
          <form className="shReq__card" onSubmit={submit}>
            {kind === "intimate" ? (
              <div className="shReq__note">
                We hide reported images right away and act on every request
                within 48 hours, including copies posted elsewhere on SkyHub.
                You can also use{" "}
                <a
                  href="https://takeitdown.ncmec.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  Take It Down
                </a>{" "}
                (for images taken under 18) or{" "}
                <a href="https://stopncii.org" target="_blank" rel="noreferrer">
                  StopNCII.org
                </a>{" "}
                to block the image across other sites.
              </div>
            ) : (
              <div className="shReq__note">
                Under the DMCA, a notice must include the details below.
                Knowingly false claims can carry legal liability, so if you're
                unsure whether you own it, check first.
              </div>
            )}

            <div className="shReq__grid">
              <label className="shReq__field">
                Your full name
                <input
                  value={f.name}
                  onChange={set("name")}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="shReq__field">
                Email
                <input
                  type="email"
                  value={f.email}
                  onChange={set("email")}
                  required
                  autoComplete="email"
                />
              </label>
            </div>

            <label className="shReq__field">
              {kind === "intimate" ? "I'm making this request" : "I am"}
              <select value={f.relationship} onChange={set("relationship")}>
                {kind === "intimate" ? (
                  <>
                    <option value="self">For myself (I'm in the image)</option>
                    <option value="authorized">
                      On behalf of the person in the image
                    </option>
                  </>
                ) : (
                  <>
                    <option value="owner">The copyright owner</option>
                    <option value="agent">
                      Authorized to act for the owner
                    </option>
                  </>
                )}
              </select>
            </label>

            {kind === "copyright" && (
              <label className="shReq__field">
                The work you own
                <textarea
                  rows={2}
                  value={f.copyrightedWork}
                  onChange={set("copyrightedWork")}
                  placeholder="e.g. My photo of Positano at sunset, published on my site at …"
                  required
                />
              </label>
            )}

            <label className="shReq__field">
              Where is it on SkyHub?
              <textarea
                rows={2}
                value={f.contentLinks}
                onChange={set("contentLinks")}
                placeholder="Paste the post link(s). If you don't have a link, describe it below."
              />
            </label>
            <label className="shReq__field">
              Anything that helps us find it
              <textarea
                rows={3}
                value={f.description}
                onChange={set("description")}
                placeholder="Who posted it, when, what it shows (no need to upload the image)"
              />
            </label>

            <label className="shReq__check">
              <input
                type="checkbox"
                checked={f.goodFaith}
                onChange={set("goodFaith")}
              />
              <span>
                {kind === "intimate"
                  ? "I have a good-faith belief that this intimate image was shared without the consent of the person in it."
                  : "I have a good-faith belief that this use isn't authorized by the copyright owner, its agent, or the law."}
              </span>
            </label>
            {kind === "copyright" && (
              <label className="shReq__check">
                <input
                  type="checkbox"
                  checked={f.accuracyUnderPenalty}
                  onChange={set("accuracyUnderPenalty")}
                />
                <span>
                  The information in this notice is accurate, and under penalty
                  of perjury, I am the owner or authorized to act for the owner.
                </span>
              </label>
            )}

            <label className="shReq__field">
              Signature (type your full name)
              <input value={f.signature} onChange={set("signature")} required />
            </label>

            {error && <div className="shReq__error">{error}</div>}
            <button className="shReq__submit" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send request"}
            </button>
            {kind === "intimate" && (
              <p className="shReq__muted">
                If you're in danger, call 911. For support, the Cyber Civil
                Rights Initiative helpline is 844-878-2274.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
