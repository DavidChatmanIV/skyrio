import React, { useState } from "react";
import { Button, Input, Avatar, message as antdMessage } from "antd";
import { UserAddOutlined, SyncOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Brain,
  SplitSquareHorizontal,
  Hotel,
  Zap,
  Plane,
  Users,
} from "lucide-react";
import "@/styles/SyncTogether.css";

const FEATURES = [
  {
    icon: <Brain size={22} />,
    title: "Smart Date Matching",
    body: "Tell us when everyone's free. Atlas finds the overlap and picks the best window automatically.",
  },
  {
    icon: <SplitSquareHorizontal size={22} />,
    title: "Fair Budget Split",
    body: "Different budgets, same trip. Everyone stays comfortable — no awkward money conversations.",
  },
  {
    icon: <Hotel size={22} />,
    title: "Group Stay Finder",
    body: "Atlas finds hotels and rentals that fit your whole group — price, location, and vibe.",
  },
  {
    icon: <Zap size={22} />,
    title: "XP for Everyone",
    body: "Every traveler earns Passport XP on group trips. Plan together, level up together.",
  },
];

export default function SyncTogether() {
  const [emails, setEmails] = useState([]);
  const [inputVal, setInputVal] = useState("");

  const addTraveler = () => {
    const val = inputVal.trim();
    if (!val) return;
    if (emails.includes(val)) {
      antdMessage.warning("Already added");
      return;
    }
    setEmails((prev) => [...prev, val]);
    setInputVal("");
  };

  const removeTraveler = (email) =>
    setEmails((prev) => prev.filter((e) => e !== email));

  return (
    <section className="sk-sync-section">
      {/* ── Header ── */}
      <div className="sk-sync-header">
        <div className="sk-sync-badge">
          <Plane size={12} style={{ marginRight: 6 }} />
          Group Travel
        </div>
        <h2 className="sk-sync-title">
          Tell us who's coming.
          <br />
          <span className="sk-sync-highlight">We'll handle the rest.</span>
        </h2>
        <p className="sk-sync-sub">
          Add your travel crew, set everyone's budget and Atlas builds a plan
          that works for the whole group flights, hotels and splits included.
        </p>
        <div className="sk-sync-trust">
          <span>No account required to plan</span>
          <span className="sk-sync-trust-dot">·</span>
          <span>Free to use</span>
          <span className="sk-sync-trust-dot">·</span>
          <span>Everyone earns XP</span>
        </div>
      </div>

      {/* ── Feature grid ── */}
      <div className="sk-sync-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="sk-sync-card">
            <div className="sk-sync-card-icon">{f.icon}</div>
            <div className="sk-sync-card-title">{f.title}</div>
            <div className="sk-sync-card-body">{f.body}</div>
          </div>
        ))}
      </div>

      {/* ── Group builder ── */}
      <div className="sk-sync-group-builder">
        <div className="sk-sync-group-title">
          <Users
            size={16}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Who's joining you?
        </div>
        <p className="sk-sync-group-hint">
          Add names or emails — we'll send them a link to join the plan.
        </p>
        <div className="sk-sync-group-input-row">
          <Input
            className="sk-sync-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onPressEnter={addTraveler}
            placeholder="Name or email address"
          />
          <Button
            className="sk-sync-add-btn"
            icon={<UserAddOutlined />}
            onClick={addTraveler}
          >
            Add
          </Button>
        </div>

        {emails.length > 0 && (
          <div className="sk-sync-travelers">
            {emails.map((email) => (
              <div key={email} className="sk-sync-traveler-pill">
                <Avatar
                  size={24}
                  style={{
                    background: "#ff8a2a",
                    color: "#1b1024",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {email[0].toUpperCase()}
                </Avatar>
                <span>{email}</span>
                <button
                  type="button"
                  className="sk-sync-remove"
                  onClick={() => removeTraveler(email)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {emails.length > 0 && (
          <p className="sk-sync-count">
            {emails.length} traveler{emails.length !== 1 ? "s" : ""} added —
            ready to sync
          </p>
        )}
      </div>

      {/* ── CTA ── */}
      <div className="sk-sync-cta">
        <Button
          className="sk-sync-cta-btn"
          icon={<SyncOutlined />}
          size="large"
        >
          Start planning together
        </Button>
        <p className="sk-sync-cta-sub">One plan. Every traveler covered.</p>
      </div>
    </section>
  );
}
