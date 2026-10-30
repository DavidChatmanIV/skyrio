// The SkyHub community guidelines and how they're enforced.
// Keep the "How we enforce" section in sync with STRIKE_POLICY in
// backend/services/skyhubModeration.js if you change the ladder.

import React from "react";
import { Link } from "react-router-dom";
import SkyHubSafetyPolicies from "./SkyHubSafetyPolicies";

const wrap = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "40px 16px 120px",
  color: "#f2eefa",
  lineHeight: 1.65,
};
const h2 = { fontSize: 20, margin: "34px 0 10px", color: "#fff" };
const muted = { color: "rgba(242,238,250,0.65)" };
const card = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 14,
  padding: "14px 18px",
};

const RULES = [
  [
    "Be respectful",
    "Disagree with ideas, not people. No harassment, bullying, insults or piling on.",
  ],
  [
    "No hate",
    "No attacks on people for their race, ethnicity, nationality, religion, gender, sexual orientation, disability or similar.",
  ],
  [
    "No threats or violence",
    "Don't threaten, encourage or celebrate violence or harm.",
  ],
  ["Keep it safe for everyone", "No nudity or sexual content."],
  [
    "No scams or spam",
    "No fake deals, phishing, referral-link farming, ads, or posting the same thing over and over.",
  ],
  [
    "Be honest",
    "Don't share false or misleading travel information (fake visa rules, made-up prices) or pretend to be someone else.",
  ],
  [
    "Protect privacy",
    "Don't post other people's personal information, booking details or photos of them without permission.",
  ],
  [
    "Keep it about travel",
    "Tips, stories, questions and trip ideas. Off-topic posts may be removed.",
  ],
];

const LADDER = [
  ["1st strike", "Warning", "The content is removed. Nothing else changes."],
  [
    "2nd strike",
    "24-hour pause",
    "You can read SkyHub but can't post, comment or react.",
  ],
  ["3rd strike", "7-day pause", "Same as the 24-hour pause, but for 7 days."],
  ["4th strike", "30-day pause", "Same as the 24-hour pause, but for 30 days."],
  [
    "5th strike",
    "Permanent suspension",
    "Your SkyHub access ends. You can still book trips.",
  ],
];

export default function SkyHubGuidelines() {
  return (
    <div style={{ minHeight: "100vh", background: "#120c1f" }}>
      <div style={wrap}>
        <Link to="/skyhub" style={{ ...muted, fontSize: 13 }}>
          ← Back to SkyHub
        </Link>
        <h1
          style={{
            fontSize: 30,
            margin: "10px 0 6px",
            color: "#fff",
            textWrap: "balance",
          }}
        >
          SkyHub community guidelines
        </h1>
        <p style={muted}>
          SkyHub is where travelers help each other travel better. These rules
          keep it useful and friendly. They apply to posts, comments, photos and
          profiles.
        </p>

        <h2 style={h2}>The rules</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {RULES.map(([t, d]) => (
            <div key={t} style={card}>
              <div style={{ fontWeight: 700, color: "#fff" }}>{t}</div>
              <div style={muted}>{d}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>How we enforce them</h2>
        <p style={muted}>
          Anyone can report a post, comment or traveler from its ⋯ menu. Reports
          are anonymous. If three different people report the same post or
          comment, it's hidden until our team reviews it. Reports about a
          child's safety or intimate images shared without consent are hidden
          right away. When something breaks the rules, we remove it and may give
          the account a strike:
        </p>
        <div style={{ ...card, padding: 0 }}>
          {LADDER.map(([n, what, detail], i) => (
            <div
              key={n}
              style={{
                padding: "12px 18px",
                borderTop: i ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: "2px 10px",
                }}
              >
                <span style={{ ...muted, fontSize: 13 }}>{n}</span>
                <span style={{ fontWeight: 700, color: "#fff" }}>{what}</span>
              </div>
              {detail && (
                <div style={{ ...muted, fontSize: 14, marginTop: 2 }}>
                  {detail}
                </div>
              )}
            </div>
          ))}
        </div>
        <ul style={{ ...muted, paddingLeft: 20 }}>
          <li>Strikes expire after 90 days.</li>
          <li>
            Serious violations — threats, hate speech, scams or sexual content —
            skip the warning and start with a 7-day pause. Repeated serious
            violations can lead straight to a permanent suspension.
          </li>
          <li>
            Pauses and suspensions only affect SkyHub. Your trips, bookings and
            Passport are never affected.
          </li>
          <li>
            We'll always tell you what was removed and why, by email and in your
            notifications.
          </li>
        </ul>

        <h2 style={h2}>Appeals</h2>
        <p style={muted}>
          If you think we made a mistake, open SkyHub, tap{" "}
          <strong style={{ color: "#fff" }}>See details</strong> on the account
          standing banner, and choose{" "}
          <strong style={{ color: "#fff" }}>Appeal this</strong> within 30 days.
          A person on our team reviews every appeal. If we agree, the strike is
          removed, any pause it caused is lifted, and your content is restored.
        </p>

        <h2 style={h2}>Blocking</h2>
        <p style={muted}>
          You can block anyone from the ⋯ menu on their post. You won't see each
          other on SkyHub, and they aren't told.
        </p>

        <h2 style={h2}>Safety and legal</h2>
        <SkyHubSafetyPolicies />
      </div>
    </div>
  );
}
