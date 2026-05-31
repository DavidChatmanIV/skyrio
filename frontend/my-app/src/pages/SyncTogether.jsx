import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button, Input, Avatar, message as antdMessage, Spin } from "antd";
import {
  UserAddOutlined,
  SyncOutlined,
  TeamOutlined,
  SearchOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  Brain,
  SplitSquareHorizontal,
  Hotel,
  Zap,
  Plane,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "@/styles/SyncTogether.css";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

/** Grab the JWT from localStorage and build auth headers */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

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
  const navigate = useNavigate();

  // ── Travelers already added ──
  const [travelers, setTravelers] = useState([]);

  // ── Search state ──
  const [inputVal, setInputVal] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // ── CTA state ──
  const [creating, setCreating] = useState(false);

  /* ────────────────────────────────────
     Debounced user search (300ms)
  ──────────────────────────────────── */
  const searchUsers = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/search?q=${encodeURIComponent(
          query.trim()
        )}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data.ok) {
        setResults(data.users || []);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(val), 300);
  };

  /* ────────────────────────────────────
     Add traveler from search results
  ──────────────────────────────────── */
  const addFromSearch = (user) => {
    const already = travelers.some((t) => t.id === (user._id || user.id));
    if (already) {
      antdMessage.warning("Already added");
    } else {
      setTravelers((prev) => [
        ...prev,
        {
          id: user._id || user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      ]);
      antdMessage.success(`${user.name || user.username} added`);
    }
    setInputVal("");
    setResults([]);
    setShowDropdown(false);
  };

  /* ────────────────────────────────────
     Add by raw email (Enter or Add btn)
  ──────────────────────────────────── */
  const addByEmail = () => {
    const val = inputVal.trim();
    if (!val) return;

    // If dropdown is showing and has results, pick the first
    if (showDropdown && results.length > 0) {
      addFromSearch(results[0]);
      return;
    }

    // Otherwise treat as an email invite
    const already = travelers.some(
      (t) => t.email === val || t.username === val
    );
    if (already) {
      antdMessage.warning("Already added");
      return;
    }

    setTravelers((prev) => [
      ...prev,
      { id: null, email: val, name: val, username: null, avatar: null },
    ]);
    setInputVal("");
    setResults([]);
    setShowDropdown(false);
  };

  /* ────────────────────────────────────
     Remove traveler
  ──────────────────────────────────── */
  const removeTraveler = (traveler) =>
    setTravelers((prev) =>
      prev.filter(
        (t) =>
          (t.id && t.id !== traveler.id) ||
          (!t.id && t.email !== traveler.email)
      )
    );

  /* ────────────────────────────────────
     Start Planning Together (CTA)
  ──────────────────────────────────── */
  const handleStartPlanning = async () => {
    if (travelers.length === 0) {
      antdMessage.warning("Add at least one traveler to get started");
      return;
    }

    setCreating(true);
    try {
      const members = travelers.map((t) => ({
        userId: t.id || undefined,
        email: t.email || undefined,
        name: t.name || undefined,
      }));

      const res = await fetch(`${API_BASE}/sync-together`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ members }),
      });

      const data = await res.json();

      if (data.ok) {
        antdMessage.success("Group created! Invitations sent.");
        navigate(`/sync-together/${data.group.id}`);
      } else {
        antdMessage.error(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error("Create group failed:", err);
      antdMessage.error("Failed to create group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  /* ────────────────────────────────────
     Close dropdown on outside click
  ──────────────────────────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        {/* Search input + dropdown */}
        <div className="sk-sync-group-input-row" ref={wrapperRef}>
          <div className="sk-sync-search-wrapper">
            <Input
              className="sk-sync-input"
              value={inputVal}
              onChange={handleInputChange}
              onPressEnter={addByEmail}
              placeholder="Search by name, username, or email"
              prefix={<SearchOutlined style={{ color: "#ff8a2a" }} />}
              suffix={
                searching ? (
                  <Spin
                    indicator={
                      <LoadingOutlined
                        style={{ fontSize: 14, color: "#ff8a2a" }}
                      />
                    }
                  />
                ) : null
              }
            />

            {/* Search results dropdown */}
            {showDropdown && results.length > 0 && (
              <div className="sk-sync-search-dropdown">
                {results.map((user) => (
                  <div
                    key={user._id || user.id}
                    className="sk-sync-search-item"
                    onClick={() => addFromSearch(user)}
                  >
                    <Avatar
                      size={32}
                      src={
                        user.avatar && user.avatar !== "/default-avatar.png"
                          ? user.avatar
                          : undefined
                      }
                      style={{
                        background: "#ff8a2a",
                        color: "#1b1024",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {(user.name || user.username || "?")[0].toUpperCase()}
                    </Avatar>
                    <div className="sk-sync-search-item-info">
                      <span className="sk-sync-search-item-name">
                        {user.name || user.username}
                      </span>
                      <span className="sk-sync-search-item-handle">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No results message */}
            {showDropdown &&
              results.length === 0 &&
              !searching &&
              inputVal.trim().length >= 2 && (
                <div className="sk-sync-search-dropdown">
                  <div className="sk-sync-search-empty">
                    No users found — press Enter to invite by email
                  </div>
                </div>
              )}
          </div>

          <Button
            className="sk-sync-add-btn"
            icon={<UserAddOutlined />}
            onClick={addByEmail}
          >
            Add
          </Button>
        </div>

        {/* Added travelers */}
        {travelers.length > 0 && (
          <div className="sk-sync-travelers">
            {travelers.map((t, i) => (
              <div key={t.id || t.email || i} className="sk-sync-traveler-pill">
                <Avatar
                  size={24}
                  src={
                    t.avatar && t.avatar !== "/default-avatar.png"
                      ? t.avatar
                      : undefined
                  }
                  style={{
                    background: "#ff8a2a",
                    color: "#1b1024",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {(t.name || t.email || "?")[0].toUpperCase()}
                </Avatar>
                <span>{t.name || t.username || t.email}</span>
                {t.username && (
                  <span style={{ opacity: 0.5, fontSize: 12 }}>
                    @{t.username}
                  </span>
                )}
                <button
                  type="button"
                  className="sk-sync-remove"
                  onClick={() => removeTraveler(t)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {travelers.length > 0 && (
          <p className="sk-sync-count">
            {travelers.length} traveler{travelers.length !== 1 ? "s" : ""} added
            — ready to sync
          </p>
        )}
      </div>

      {/* ── CTA ── */}
      <div className="sk-sync-cta">
        <Button
          className="sk-sync-cta-btn"
          icon={<SyncOutlined spin={creating} />}
          size="large"
          onClick={handleStartPlanning}
          loading={creating}
          disabled={travelers.length === 0}
        >
          Start planning together
        </Button>
        <p className="sk-sync-cta-sub">One plan. Every traveler covered.</p>
      </div>
    </section>
  );
}
