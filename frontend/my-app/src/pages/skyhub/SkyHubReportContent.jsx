// /skyhub/report-content — formal removal requests for SkyHub content.
// Linked from the report window (intimate images) and the community
// guidelines (?kind=copyright). Works without an account.
// Sends to POST /api/skyhub/removal-requests (backend/routes/removalRequests.routes.js).
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert, Check, AlertTriangle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const SUPPORT_EMAIL = "skyrioofficial@gmail.com";

const KINDS = [
  { key: "intimate", label: "Intimate image shared without consent" },
  { key: "copyright", label: "My copyrighted work" },
  { key: "privacy", label: "My private info" },
  { key: "other", label: "Something else" },
];

const CSS = `
.rc-wrap { max-width: 560px; margin: 0 auto; padding: 72px 16px 120px; color: #fff; font-family: "DM Sans", system-ui, sans-serif; }
.rc-card { position: relative; overflow: hidden; padding: 22px 20px 20px; border-radius: 20px;
  background: linear-gradient(160deg, rgba(74,40,112,.6), rgba(34,18,62,.7));
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 44px rgba(12,4,28,.38);
  backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); }
.rc-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); }
.rc-kicker { font-size: 11.5px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #ffb347; }
.rc-title { margin: 4px 0 4px; font-size: 22px; font-weight: 800; line-height: 1.2; }
.rc-sub { margin: 0 0 14px; font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,.78); }
.rc-alert { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 4px; padding: 10px 12px; border-radius: 12px;
  background: rgba(255,107,133,.08); border: 1px solid rgba(255,107,133,.35); font-size: 12.5px; line-height: 1.5; }
.rc-alert svg { flex-shrink: 0; margin-top: 2px; color: #ff8fa3; }
.rc-alert a, .rc-link { color: #ffb347; font-weight: 700; }
.rc-label { display: block; margin: 14px 0 5px; font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.rc-hint { margin: -1px 0 5px; font-size: 12px; color: rgba(255,255,255,.6); }
.rc-input, .rc-text { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; font: inherit; font-size: 14px; color: #fff;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18); outline: none; }
.rc-input:focus, .rc-text:focus { border-color: #ff8a2a; }
.rc-text { resize: vertical; min-height: 56px; }
.rc-choices { display: grid; gap: 6px; grid-template-columns: 1fr 1fr; }
@media (max-width: 520px) { .rc-choices { grid-template-columns: 1fr; } }
.rc-choice { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.14); font-size: 13px; line-height: 1.3; }
.rc-choice.is-on { border-color: #ff8a2a; background: rgba(255,138,42,.1); }
.rc-choice input, .rc-check input { accent-color: #ff8a2a; width: 15px; height: 15px; flex-shrink: 0; margin: 0; }
.rc-check { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; font-size: 12.5px; line-height: 1.5; cursor: pointer; }
.rc-check input { margin-top: 2px; }
.rc-btn { width: 100%; min-height: 46px; margin-top: 16px; border: 0; border-radius: 999px; cursor: pointer; font: inherit; font-size: 14.5px; font-weight: 800;
  color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); box-shadow: 0 10px 26px rgba(255,138,42,.3); }
.rc-btn:disabled { opacity: .5; cursor: default; }
.rc-error { display: flex; gap: 8px; align-items: center; margin-top: 14px; color: #ff9db0; font-size: 13.5px; }
.rc-done { text-align: center; }
.rc-doneIcon { width: 60px; height: 60px; margin: 0 auto 14px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
  color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.rc-foot { margin-top: 12px; font-size: 12px; line-height: 1.55; color: rgba(255,255,255,.6); }
.rc-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.rc-wrap :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
`;

export default function SkyHubReportContent() {
  const [params] = useSearchParams();
  const initialKind = KINDS.some((k) => k.key === params.get("kind"))
    ? params.get("kind")
    : "intimate";

  const [kind, setKind] = useState(initialKind);
  const [f, setF] = useState({
    urls: params.get("post") || "",
    fullName: "",
    email: "",
    onBehalf: "self",
    workDescription: "",
    originalUrl: "",
    details: "",
    goodFaith: false,
    accurate: false,
    perjury: false,
    website: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k) => (e) =>
    setF((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const isCopyright = kind === "copyright";
  const isIntimate = kind === "intimate";
  const ready =
    f.urls.trim() &&
    f.fullName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) &&
    f.accurate &&
    (!isCopyright || (f.workDescription.trim() && f.perjury)) &&
    (!(isCopyright || isIntimate) || f.goodFaith);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/skyhub/removal-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...f }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        throw new Error(
          data.message || `Couldn't send it. Email ${SUPPORT_EMAIL} instead.`
        );
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err.message || `Couldn't send it. Email ${SUPPORT_EMAIL} instead.`
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="rc-wrap">
        <style>{CSS}</style>
        <div className="rc-card rc-done" role="status">
          <div className="rc-doneIcon">
            <Check size={28} aria-hidden="true" />
          </div>
          <h1 className="rc-title">Request received</h1>
          <p className="rc-sub">
            {isIntimate
              ? "We'll review it and remove the image within 48 hours if it breaks our rules."
              : "We'll review it and email you with what we did."}{" "}
            A copy is on its way to {f.email.trim()}.
          </p>
          <Link to="/skyhub" className="rc-link">
            Back to SkyHub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-wrap">
      <style>{CSS}</style>
      <form className="rc-card" onSubmit={submit} noValidate>
        <div className="rc-kicker">SkyHub</div>
        <h1 className="rc-title">Request removal</h1>
        <p className="rc-sub">
          Ask us to take down a SkyHub post. No account needed.
          {isIntimate && (
            <>
              {" "}
              <b style={{ color: "#fff" }}>
                Intimate images are removed within 48 hours.
              </b>
            </>
          )}
        </p>

        <div className="rc-alert" role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            <b>Involves a child?</b> Don&apos;t share or download it. Report it
            to the{" "}
            <a
              href="https://report.cybertip.org"
              target="_blank"
              rel="noreferrer"
            >
              NCMEC CyberTipline
            </a>{" "}
            and use Report on the post. If anyone is in danger, call 911.
          </span>
        </div>

        <span className="rc-label">What is it?</span>
        <div className="rc-choices" role="radiogroup" aria-label="What is it?">
          {KINDS.map((k) => (
            <label
              key={k.key}
              className={`rc-choice${kind === k.key ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="rc-kind"
                checked={kind === k.key}
                onChange={() => setKind(k.key)}
              />
              {k.label}
            </label>
          ))}
        </div>

        <label className="rc-label" htmlFor="rc-urls">
          Link to the post
        </label>
        <p className="rc-hint">
          One per line. Open the post, then copy the address.
        </p>
        <textarea
          id="rc-urls"
          className="rc-text"
          value={f.urls}
          onChange={set("urls")}
          placeholder="https://www.myskyrio.com/skyhub/…"
          required
        />

        {isIntimate && (
          <>
            <span className="rc-label">Who is in the image?</span>
            <div
              className="rc-choices"
              role="radiogroup"
              aria-label="Who is in the image?"
            >
              {[
                ["self", "Me"],
                ["authorized", "Someone I'm authorized to act for"],
              ].map(([v, l]) => (
                <label
                  key={v}
                  className={`rc-choice${f.onBehalf === v ? " is-on" : ""}`}
                >
                  <input
                    type="radio"
                    name="rc-behalf"
                    checked={f.onBehalf === v}
                    onChange={() => setF((p) => ({ ...p, onBehalf: v }))}
                  />
                  {l}
                </label>
              ))}
            </div>
          </>
        )}

        {isCopyright && (
          <>
            <label className="rc-label" htmlFor="rc-work">
              Your work
            </label>
            <p className="rc-hint">
              What you own, e.g. "my photo of Tulum beach, 2025".
            </p>
            <textarea
              id="rc-work"
              className="rc-text"
              value={f.workDescription}
              onChange={set("workDescription")}
              required
            />
            <label className="rc-label" htmlFor="rc-orig">
              Where the original is (optional)
            </label>
            <input
              id="rc-orig"
              className="rc-input"
              value={f.originalUrl}
              onChange={set("originalUrl")}
              placeholder="https://"
            />
          </>
        )}

        <label className="rc-label" htmlFor="rc-details">
          Anything else? (optional)
        </label>
        <textarea
          id="rc-details"
          className="rc-text"
          rows={2}
          value={f.details}
          onChange={set("details")}
        />

        <label className="rc-label" htmlFor="rc-name">
          Full name
        </label>
        <p className="rc-hint">Typing your name is your signature.</p>
        <input
          id="rc-name"
          className="rc-input"
          value={f.fullName}
          onChange={set("fullName")}
          autoComplete="name"
          required
        />

        <label className="rc-label" htmlFor="rc-email">
          Email
        </label>
        <p className="rc-hint">
          We&apos;ll send updates here. It&apos;s never shown.
        </p>
        <input
          id="rc-email"
          className="rc-input"
          type="email"
          value={f.email}
          onChange={set("email")}
          autoComplete="email"
          required
        />

        {/* Bots fill this in; people never see it */}
        <div className="rc-hp" aria-hidden="true">
          <input
            tabIndex={-1}
            autoComplete="off"
            value={f.website}
            onChange={set("website")}
          />
        </div>

        {(isIntimate || isCopyright) && (
          <label className="rc-check">
            <input
              type="checkbox"
              checked={f.goodFaith}
              onChange={set("goodFaith")}
            />
            <span>
              {isIntimate
                ? "I believe in good faith this image was shared without consent."
                : "I believe in good faith this use isn't allowed by the owner, their agent or the law."}
            </span>
          </label>
        )}
        {isCopyright && (
          <label className="rc-check">
            <input
              type="checkbox"
              checked={f.perjury}
              onChange={set("perjury")}
            />
            <span>
              Under penalty of perjury, I own this work or am authorized to act
              for the owner.
            </span>
          </label>
        )}
        <label className="rc-check">
          <input
            type="checkbox"
            checked={f.accurate}
            onChange={set("accurate")}
          />
          <span>The information here is accurate.</span>
        </label>

        {error && (
          <p className="rc-error" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {error}
          </p>
        )}

        <button type="submit" className="rc-btn" disabled={!ready || sending}>
          {sending ? "Sending…" : "Send removal request"}
        </button>

        <p className="rc-foot">
          Prefer email? Write to{" "}
          <a className="rc-link" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . See the{" "}
          <Link className="rc-link" to="/skyhub/guidelines">
            community guidelines
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
