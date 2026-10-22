// A small, skippable card that tells people booking for others about
// Sync Together. Shown in checkout (and after booking) only when it fits:
// 2+ travelers or 2+ rooms, and not already part of a group trip.
// Closing it hides it for the rest of the visit.
import React, { useState } from "react";
import { Users, ArrowRight, X } from "lucide-react";

const KEY = "skyrio_sync_nudge_hidden";

const CSS = `
.stn { position: relative; display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 40px 14px 14px; margin: 0 0 18px; border-radius: 14px; overflow: hidden;
  background: rgba(16,11,34,0.82); border: 1px solid rgba(139,108,255,0.35);
  color: #fff; font-family: inherit; text-align: left; }
.stn::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
  background: linear-gradient(90deg,#ff8a2a,#ffb347 45%,#8b6cff); }
.stn-icon { width: 34px; height: 34px; flex-shrink: 0; display: inline-flex; align-items: center;
  justify-content: center; border-radius: 10px; background: rgba(139,108,255,0.16); color: #b9a6ff; }
.stn-eyebrow { font: 600 10px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .18em;
  text-transform: uppercase; color: #b9a6ff; }
.stn-title { margin-top: 2px; font-size: 14.5px; font-weight: 800; line-height: 1.3; }
.stn-sub { margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,0.72); }
.stn-go { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; min-height: 36px;
  padding: 0 14px; border-radius: 999px; border: 1px solid rgba(139,108,255,0.55);
  background: rgba(139,108,255,0.14); color: #fff; font: 700 13px inherit; font-family: inherit;
  text-decoration: none; cursor: pointer; }
.stn-go:hover { background: rgba(139,108,255,0.26); color: #fff; }
.stn-close { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; display: inline-flex;
  align-items: center; justify-content: center; border: 0; border-radius: 50%; background: transparent;
  color: rgba(255,255,255,0.65); cursor: pointer; }
.stn-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
.stn :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
`;

const COPY = {
  hotel: {
    title: "Booking for friends or family?",
    sub: "With Sync Together, your group plans the trip together and can split a shared room so everyone pays their own part. Each person needs a free Skyrio account.",
  },
  flight: {
    title: "Flying with friends or family?",
    sub: "With Sync Together, your group plans the trip together and everyone books and pays for their own seat. Each person needs a free Skyrio account.",
  },
  after: {
    title: "Planning the next one together?",
    sub: "Sync Together lets your group vote on plans and pay their own way, so nobody has to front the whole bill. Each person needs a free Skyrio account.",
  },
};

export default function SyncTogetherNudge({
  kind = "hotel",
  href = "/sync-together",
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const c = COPY[kind] || COPY.hotel;
  const hide = () => {
    setHidden(true);
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* non-fatal */
    }
  };
  return (
    <aside className="stn" aria-label="Sync Together">
      <style>{CSS}</style>
      <span className="stn-icon" aria-hidden="true">
        <Users size={17} />
      </span>
      <div>
        <div className="stn-eyebrow">Sync Together</div>
        <div className="stn-title">{c.title}</div>
        <div className="stn-sub">{c.sub}</div>
        {/* New tab, so nothing typed in checkout is lost */}
        <a
          className="stn-go"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          See how it works <ArrowRight size={14} aria-hidden="true" />
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            (opens in a new tab)
          </span>
        </a>
      </div>
      <button
        type="button"
        className="stn-close"
        onClick={hide}
        aria-label="Hide this tip"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </aside>
  );
}
