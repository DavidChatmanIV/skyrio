// The SkyHub community guidelines and how they're enforced.
// Keep the "How we enforce" section in sync with STRIKE_POLICY in
// backend/services/skyhubModeration.js if you change the ladder.
// Purple glass to match the rest of Skyrio (same look as the removal form).

import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Ban,
  ShieldAlert,
  EyeOff,
  BadgeAlert,
  CheckCircle2,
  Lock,
  Plane,
  Flag,
  Scale,
  UserX,
} from "lucide-react";
import SkyHubSafetyPolicies from "./SkyHubSafetyPolicies";

const RULES = [
  [
    Heart,
    "Be respectful",
    "Disagree with ideas, not people. No harassment, bullying or insults.",
  ],
  [
    Ban,
    "No hate",
    "No attacks on anyone's race, ethnicity, nationality, religion, gender, sexual orientation, disability or similar.",
  ],
  [
    ShieldAlert,
    "No threats or violence",
    "Don't threaten, encourage or celebrate harm.",
  ],
  [EyeOff, "Keep it safe for everyone", "No nudity or sexual content."],
  [
    BadgeAlert,
    "No scams or spam",
    "No fake deals, phishing, referral farming, ads or repeat posts.",
  ],
  [
    CheckCircle2,
    "Be honest",
    "No false travel info (fake visa rules, made-up prices) or pretending to be someone else.",
  ],
  [
    Lock,
    "Protect privacy",
    "Don't post other people's info, bookings or photos without permission.",
  ],
  [
    Plane,
    "Keep it about travel",
    "Tips, stories, questions and trip ideas. Off-topic posts may be removed.",
  ],
];

const LADDER = [
  ["1st", "Warning", "The content is removed. Nothing else changes."],
  [
    "2nd",
    "24-hour pause",
    "You can read SkyHub but can't post, comment or react.",
  ],
  ["3rd", "7-day pause", "Same, for 7 days."],
  ["4th", "30-day pause", "Same, for 30 days."],
  [
    "5th",
    "Permanent suspension",
    "SkyHub access ends. You can still book trips.",
  ],
];

const CSS = `
.gl-wrap { max-width: 760px; margin: 0 auto; padding: 72px 16px 120px; color: #fff; font-family: "DM Sans", system-ui, sans-serif; line-height: 1.55; }
.gl-glass { position: relative; overflow: hidden; border-radius: 20px;
  background: linear-gradient(160deg, rgba(74,40,112,.62), rgba(34,18,62,.74));
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 44px rgba(12,4,28,.38);
  backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .gl-glass { background: linear-gradient(160deg, rgba(56,30,88,.96), rgba(28,14,52,.97)); }
}
.gl-hero { padding: 24px 22px 22px; margin-bottom: 26px; }
.gl-hero::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); }
.gl-back { display: inline-flex; align-items: center; gap: 6px; color: #ffb347; font-size: 13px; font-weight: 700; text-decoration: none; }
.gl-back:hover { color: #fff; }
.gl-kicker { margin-top: 14px; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #ffb347; }
.gl-title { margin: 4px 0 6px; font-size: clamp(22px, 3.4vw, 28px); font-weight: 800; line-height: 1.2; text-wrap: balance; }
.gl-sub { margin: 0; font-size: 14px; color: rgba(255,255,255,.78); }
.gl-h2 { display: inline-flex; align-items: center; gap: 8px; margin: 28px 0 10px; padding: 6px 14px 6px 12px; border-radius: 999px; font-size: 16px; font-weight: 800; background: rgba(42,22,80,.82); border: 1px solid rgba(255,255,255,.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.gl-h2 svg { color: #ffb347; }
.gl-p { margin: 0 0 12px; font-size: 14px; color: rgba(255,255,255,.78); }
.gl-p b { color: #fff; }
.gl-rules { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 620px) { .gl-rules { grid-template-columns: 1fr; } }
.gl-rule { display: flex; gap: 12px; align-items: flex-start; padding: 14px; }
.gl-ico { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  color: #ffb347; background: rgba(255,138,42,.14); border: 1px solid rgba(255,138,42,.28); }
.gl-rule b { display: block; font-size: 14.5px; }
.gl-rule > div > span { display: block; margin-top: 2px; font-size: 13px; color: rgba(255,255,255,.72); }
.gl-ladder { padding: 4px 0; }
.gl-step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; }
.gl-step + .gl-step { border-top: 1px dashed rgba(255,255,255,.12); }
.gl-num { flex-shrink: 0; min-width: 42px; height: 24px; padding: 0 8px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; letter-spacing: .06em; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.gl-step:last-child .gl-num { color: #fff; background: rgba(255,107,133,.35); }
.gl-step b { display: block; font-size: 14.5px; }
.gl-step span { display: block; font-size: 13px; color: rgba(255,255,255,.72); }
.gl-list { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.gl-list li { position: relative; padding-left: 18px; font-size: 13.5px; color: rgba(255,255,255,.85); }
.gl-list li::before { content: ""; position: absolute; left: 4px; top: 8px; width: 6px; height: 6px; border-radius: 50%; background: #ffb347; }
.gl-box { padding: 16px 18px; }
.gl-box .gl-p:last-child { margin-bottom: 0; }
.gl-legal { padding: 16px 18px; font-size: 14px; color: rgba(255,255,255,.8); }
.gl-legal a { color: #ffb347; font-weight: 700; }
.gl-legal h3, .gl-legal h4 { color: #fff; }
.gl-wrap :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
`;

export default function SkyHubGuidelines() {
  return (
    <div className="gl-wrap">
      <style>{CSS}</style>

      <header className="gl-glass gl-hero">
        <Link to="/skyhub" className="gl-back">
          <ArrowLeft size={14} aria-hidden="true" /> Back to SkyHub
        </Link>
        <div className="gl-kicker">SkyHub</div>
        <h1 className="gl-title">Community guidelines</h1>
        <p className="gl-sub">
          Travelers helping travelers. These rules cover posts, comments, photos
          and profiles.
        </p>
      </header>

      <h2 className="gl-h2">
        <Heart size={17} aria-hidden="true" /> The rules
      </h2>
      <div className="gl-rules">
        {RULES.map(([Icon, t, d]) => (
          <div key={t} className="gl-glass gl-rule">
            <span className="gl-ico">
              <Icon size={17} aria-hidden="true" />
            </span>
            <div>
              <b>{t}</b>
              <span>{d}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="gl-h2">
        <Flag size={17} aria-hidden="true" /> How we enforce them
      </h2>
      <div className="gl-glass gl-box" style={{ marginBottom: 10 }}>
        <p className="gl-p">
          Report anything from its <b>⋯</b> menu. Reports are anonymous. A post
          or comment reported by 3 different people is hidden until we review
          it. Reports about a <b>child&rsquo;s safety</b> or{" "}
          <b>intimate images shared without consent</b> are hidden right away.
          Breaking the rules gets the content removed and may add a strike:
        </p>
      </div>
      <div className="gl-glass gl-ladder">
        {LADDER.map(([n, what, detail]) => (
          <div key={n} className="gl-step">
            <span className="gl-num">{n}</span>
            <div>
              <b>{what}</b>
              <span>{detail}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="gl-glass gl-box" style={{ marginTop: 10 }}>
        <ul className="gl-list" style={{ marginTop: 0 }}>
          <li>Strikes expire after 90 days.</li>
          <li>
            Serious violations (threats, hate speech, scams, sexual content)
            skip the warning and start at a 7-day pause. Repeats can mean
            permanent suspension.
          </li>
          <li>
            Pauses only affect SkyHub. Your trips, bookings and Passport are
            never touched.
          </li>
          <li>
            We always tell you what was removed and why, by email and in
            notifications.
          </li>
        </ul>
      </div>

      <h2 className="gl-h2">
        <Scale size={17} aria-hidden="true" /> Appeals
      </h2>
      <div className="gl-glass gl-box">
        <p className="gl-p">
          Think we got it wrong? On SkyHub, tap <b>See details</b> on the
          standing banner, then <b>Appeal this</b> within 30 days. A person
          reviews every appeal. If we agree, the strike and any pause are
          removed and your content comes back.
        </p>
      </div>

      <h2 className="gl-h2">
        <UserX size={17} aria-hidden="true" /> Blocking
      </h2>
      <div className="gl-glass gl-box">
        <p className="gl-p">
          Block anyone from the <b>⋯</b> menu on their post. You won&rsquo;t see
          each other on SkyHub, and they aren&rsquo;t told.
        </p>
      </div>

      <h2 className="gl-h2">
        <ShieldAlert size={17} aria-hidden="true" /> Safety and legal
      </h2>
      <div className="gl-glass gl-legal">
        <SkyHubSafetyPolicies />
      </div>
    </div>
  );
}
