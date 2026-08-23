import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Avatar, Spin, Input, message as antdMessage } from "antd";
import { Plane, Users, MapPin, Calendar } from "lucide-react";
import dayjs from "dayjs";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/SyncTogether.css";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function JoinTripPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isAuthed, login, signup } = useAuth();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  // Inline auth form state — kept self-contained here so someone
  // can sign in/up without losing their place in the invite flow.
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/sync-together/preview/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPreview(data.preview);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  const joinTrip = async () => {
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/join/${code}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        antdMessage.success(
          data.alreadyMember ? "Taking you to the trip..." : "You're in!"
        );
        navigate(`/sync-together/${data.group.id || data.group._id}`);
      } else {
        antdMessage.error(data.error || "Couldn't join this trip");
      }
    } catch (err) {
      antdMessage.error("Something went wrong joining the trip");
    } finally {
      setJoining(false);
    }
  };

  const handleAuthSubmit = async () => {
    if (!email || !password) {
      antdMessage.warning("Enter your email and password");
      return;
    }
    setAuthLoading(true);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await signup({ email, password, name, username });
      }
      // Session is set — immediately continue into the trip.
      await joinTrip();
    } catch (err) {
      antdMessage.error(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="sk-sync-section">
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <Spin size="large" />
        </div>
      </section>
    );
  }

  if (notFound || !preview) {
    return (
      <section className="sk-sync-section">
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <h2 style={{ color: "#fff" }}>This invite link isn't valid</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
            It may have expired, or the trip may have been deleted.
          </p>
          <Button
            className="sk-sync-cta-btn"
            onClick={() => navigate("/sync-together")}
            style={{ marginTop: 24 }}
          >
            Go to Sync Together
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="sk-sync-section">
      <div
        style={{
          maxWidth: 460,
          margin: "40px auto 0",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "32px 28px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Plane size={28} style={{ color: "#ff8a2a" }} />
        </div>

        <h2
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            textAlign: "center",
            margin: "0 0 6px",
          }}
        >
          You&apos;re invited to a group trip!
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            fontSize: 14,
            margin: "0 0 24px",
          }}
        >
          <span style={{ color: "#ff8a2a", fontWeight: 600 }}>
            {preview.ownerName}
          </span>{" "}
          wants you to join
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 24,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
            {preview.title}
          </div>
          {preview.destination && (
            <div
              style={{
                color: "#ff8a2a",
                fontSize: 14,
                fontWeight: 600,
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MapPin size={14} /> {preview.destination}
            </div>
          )}
          {preview.dateRangeStart && preview.dateRangeEnd && (
            <div
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Calendar size={13} />
              {dayjs(preview.dateRangeStart).format("MMM D")} –{" "}
              {dayjs(preview.dateRangeEnd).format("MMM D, YYYY")}
            </div>
          )}
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Users size={13} /> {preview.memberCount} traveler
            {preview.memberCount !== 1 ? "s" : ""}
          </div>
        </div>

        {isAuthed ? (
          <Button
            className="sk-sync-cta-btn"
            size="large"
            block
            onClick={joinTrip}
            loading={joining}
          >
            Join This Trip
          </Button>
        ) : (
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
                textAlign: "center",
                margin: "0 0 16px",
              }}
            >
              Sign in or create an account to join
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mode === "signup" && (
                <>
                  <Input
                    className="sk-sync-input"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    className="sk-sync-input"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </>
              )}
              <Input
                className="sk-sync-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input.Password
                className="sk-sync-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={handleAuthSubmit}
              />
              <Button
                className="sk-sync-cta-btn"
                size="large"
                block
                onClick={handleAuthSubmit}
                loading={authLoading || joining}
              >
                {mode === "login" ? "Sign In & Join" : "Create Account & Join"}
              </Button>
              <Button
                type="text"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}
              >
                {mode === "login"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
