// ─────────────────────────────────────────────────────────────
// "Refer a friend" card on the Digital Passport.
//
// Your link, how it works, progress to the next level, and the friends
// who joined through you. Data: GET /api/referral/me (it also pays out any
// rewards that are due, so opening the Passport is always up to date).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { Card } from "antd";
import {
  Gift,
  Copy,
  Check,
  Share2,
  UserPlus,
  Plane,
  Trophy,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const CSS = `
.rf-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.rf-icon { width:36px; height:36px; border-radius:11px; display:flex; align-items:center; justify-content:center; color:#1a0e06; background:linear-gradient(135deg,#ff8a2a,#ffb347); flex-shrink:0; }
.rf-title { font-size:16px; font-weight:800; color:#fff; }
.rf-sub { font-size:12.5px; color:rgba(255,255,255,.6); }
.rf-steps { list-style:none; margin:12px 0; padding:0; display:grid; gap:8px; }
.rf-steps li { display:flex; gap:10px; align-items:flex-start; font-size:13px; line-height:1.45; color:rgba(255,255,255,.82); }
.rf-steps svg { color:#ffb347; flex-shrink:0; margin-top:1px; }
.rf-steps b { color:#fff; }
.rf-link { display:flex; gap:6px; margin-top:4px; }
.rf-link input { flex:1; min-width:0; height:40px; padding:0 10px; border-radius:10px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:#fff; font:inherit; font-size:12.5px; }
.rf-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; height:40px; padding:0 12px; border-radius:10px; border:0; cursor:pointer; font:inherit; font-size:13px; font-weight:800; white-space:nowrap; }
.rf-btn--copy { color:#fff; background:linear-gradient(135deg,#7c5cfc,#9b6bff); }
.rf-btn--share { color:#1a0e06; background:linear-gradient(135deg,#ff8a2a,#ffb347); }
.rf-btn:focus-visible { outline:2px solid #ffb347; outline-offset:2px; }
.rf-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:14px 0 10px; }
.rf-stat { padding:8px; border-radius:10px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); text-align:center; }
.rf-stat b { display:block; font-size:17px; color:#fff; }
.rf-stat span { font-size:11px; color:rgba(255,255,255,.55); }
.rf-next { font-size:12.5px; color:rgba(255,255,255,.75); margin-bottom:6px; }
.rf-next b { color:#ffb347; }
.rf-bar { height:8px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }
.rf-bar span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#ff8a2a,#ffb347 50%,#7c5cfc); transition:width .4s; }
.rf-levels { display:flex; justify-content:space-between; margin-top:6px; font-size:10.5px; color:rgba(255,255,255,.45); }
.rf-levels .is-on { color:#ffb347; font-weight:700; }
.rf-friends { margin-top:12px; display:grid; gap:6px; }
.rf-friend { display:flex; justify-content:space-between; gap:8px; font-size:12.5px; color:rgba(255,255,255,.8); }
.rf-tag { font-size:11px; font-weight:800; }
.rf-tag--booked { color:#6ee7a8; }
.rf-tag--confirming { color:#ffc27a; }
.rf-tag--joined { color:rgba(255,255,255,.5); }
.rf-fine { margin-top:10px; font-size:11px; line-height:1.45; color:rgba(255,255,255,.4); }
`;

const STATUS = {
  booked: "Booked",
  confirming: "Booking confirming",
  joined: "Joined",
};

export default function ReferralCard({ token }) {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    fetch(`${API}/api/referral/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.ok && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  if (!data?.link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
    } catch {
      const el = document.getElementById("rf-link");
      el?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    const text =
      "I book my trips with Skyrio. Join with my link and get a welcome bonus:";
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Skyrio",
          text,
          url: data.link,
        });
        return;
      } catch {
        /* closed the share sheet */
      }
    }
    copy();
  };

  const { next, levels = [], booked = 0 } = data;
  // Progress toward the next level, counted from zero (1 of 3 = 33%).
  const pct = next ? Math.min(100, Math.round((booked / next.at) * 100)) : 100;

  return (
    <Card variant="borderless" className="pp-card" style={{ marginTop: 12 }}>
      <style>{CSS}</style>
      <div className="rf-head">
        <span className="rf-icon" aria-hidden="true">
          <Gift size={18} />
        </span>
        <div>
          <div className="rf-title">Refer a friend</div>
          <div className="rf-sub">
            {data.level
              ? `Level: ${data.level.name}`
              : "Travel is better together"}
          </div>
        </div>
      </div>

      <ul className="rf-steps">
        <li>
          <UserPlus size={15} aria-hidden="true" />
          <span>
            Your friend joins with your link and gets{" "}
            <b>+{data.rewards.friendWelcome} XP</b>.
          </span>
        </li>
        <li>
          <Plane size={15} aria-hidden="true" />
          <span>
            When they book their first trip, you get{" "}
            <b>+{data.rewards.perBookedFriend} XP</b>.
          </span>
        </li>
        <li>
          <Trophy size={15} aria-hidden="true" />
          <span>Reach new levels for bigger bonuses.</span>
        </li>
      </ul>

      <div className="rf-link">
        <label
          htmlFor="rf-link"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Your referral link
        </label>
        <input
          id="rf-link"
          readOnly
          value={data.link}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="rf-btn rf-btn--copy" onClick={copy}>
          {copied ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Copy size={15} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        className="rf-btn rf-btn--share"
        style={{ width: "100%", marginTop: 8 }}
        onClick={share}
      >
        <Share2 size={15} aria-hidden="true" /> Share your link
      </button>

      <div className="rf-stats">
        <div className="rf-stat">
          <b>{data.joined}</b>
          <span>Joined</span>
        </div>
        <div className="rf-stat">
          <b>{booked}</b>
          <span>Booked</span>
        </div>
        <div className="rf-stat">
          <b>{data.xpEarned}</b>
          <span>XP earned</span>
        </div>
      </div>

      {next ? (
        <div className="rf-next">
          <b>{next.remaining}</b> more{" "}
          {next.remaining === 1 ? "friend" : "friends"} booking to reach{" "}
          <b>{next.name}</b> (+{next.bonus} XP)
        </div>
      ) : (
        <div className="rf-next">
          You've reached the top level. <b>Thank you!</b>
        </div>
      )}
      <div
        className="rf-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progress to the next referral level"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="rf-levels">
        {levels.map((l) => (
          <span key={l.key} className={booked >= l.at ? "is-on" : ""}>
            {l.name}
          </span>
        ))}
      </div>

      {data.friends?.length > 0 && (
        <div className="rf-friends">
          {data.friends.map((f, i) => (
            <div key={i} className="rf-friend">
              <span>{f.name}</span>
              <span className={`rf-tag rf-tag--${f.status}`}>
                {STATUS[f.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rf-fine">
        A friend counts once their first booking is still active 3 days after
        booking. More rewards are coming as Skyrio grows.
      </div>
    </Card>
  );
}
