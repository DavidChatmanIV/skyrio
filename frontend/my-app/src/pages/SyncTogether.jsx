import React, { useState } from "react";
import { Button, Input, Avatar, message as antdMessage } from "antd";
import { UserAddOutlined, SyncOutlined, TeamOutlined } from "@ant-design/icons";
import "@/styles/SyncTogether.css";

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
        <div className="sk-sync-badge">✈️ Sync Together</div>
        <h2 className="sk-sync-title">
          Plan smarter.
          <br />
          Travel better.
          <br />
          <span className="sk-sync-highlight">Experience it together.</span>
        </h2>
        <p className="sk-sync-sub">
          We'll find the best dates, split costs fairly, and match stays for
          everyone — automatically.
        </p>
      </div>

      {/* ── Feature grid ── */}
      <div className="sk-sync-grid">
        <div className="sk-sync-card">
          <div className="sk-sync-card-icon">🧠</div>
          <div className="sk-sync-card-title">Trip Sync</div>
          <div className="sk-sync-card-body">
            We'll find the best dates for everyone automatically.
          </div>
        </div>
        <div className="sk-sync-card">
          <div className="sk-sync-card-icon">💰</div>
          <div className="sk-sync-card-title">Smart Budget Split</div>
          <div className="sk-sync-card-body">
            Everyone stays within their comfort zone.
          </div>
        </div>
        <div className="sk-sync-card">
          <div className="sk-sync-card-icon">🏨</div>
          <div className="sk-sync-card-title">AI Stay Matching</div>
          <div className="sk-sync-card-body">
            Atlas finds the best options for your whole group.
          </div>
        </div>
        <div className="sk-sync-card">
          <div className="sk-sync-card-icon">⚡</div>
          <div className="sk-sync-card-title">XP for Everyone</div>
          <div className="sk-sync-card-body">
            Every group trip earns Passport XP for all travelers.
          </div>
        </div>
      </div>

      {/* ── Group builder ── */}
      <div className="sk-sync-group-builder">
        <div className="sk-sync-group-title">
          <TeamOutlined /> Who's joining you?
        </div>
        <div className="sk-sync-group-input-row">
          <Input
            className="sk-sync-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onPressEnter={addTraveler}
            placeholder="Add email or name"
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

        <p className="sk-sync-copy">
          We'll handle the planning — you enjoy the experience.
        </p>
      </div>

      {/* ── CTA ── */}
      <div className="sk-sync-cta">
        <Button
          className="sk-sync-cta-btn"
          icon={<SyncOutlined />}
          size="large"
        >
          Start Syncing
        </Button>
        <p className="sk-sync-cta-sub">Travel better, together.</p>
      </div>
    </section>
  );
}