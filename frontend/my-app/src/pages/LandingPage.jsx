// ─────────────────────────────────────────────────────────────
// Discover — the home page ("/").
//
// One clear message, then three separate ways to plan (testers said one
// page with everything at once was overwhelming):
//   1. Search myself      → /booking (search mode)
//   2. Plan on a budget   → /booking (budget mode)
//   3. Let Atlas plan it  → opens the Atlas panel
// Then the features that set Skyrio apart: Sync Together, Passport & XP,
// SkyHub, and easy manage/cancel.
//
// Self-contained: its own styles (lp- prefix), lucide icons only (no
// emoji), works signed in or as a guest. The cosmic background comes from
// AppLayout (osq-shell--landing).
// ─────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Wallet,
  Sparkles,
  Users,
  Award,
  Globe2,
  CalendarX2,
  ArrowRight,
  Plane,
  BedDouble,
  Compass,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";

// Same key BookingPage reads, so the chosen path opens ready to go.
const PLAN_MODE_KEY = "skyrio_plan_mode";

const CSS = `
.lp { color: #fff; font-family: "DM Sans", system-ui, sans-serif; width: 100%; box-sizing: border-box; }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

/* Hero */
.lp-hero { padding: clamp(48px, 9vw, 110px) 0 clamp(36px, 6vw, 64px); text-align: center; }
.lp-kicker { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #ffc27a; background: rgba(255,138,42,.12); border: 1px solid rgba(255,138,42,.32); }
.lp-title { margin: 18px auto 0; max-width: 860px; font-family: "Playfair Display", "Syne", Georgia, serif; font-size: clamp(36px, 6.4vw, 72px); line-height: 1.04; font-weight: 800; letter-spacing: -.02em; }
.lp-title em { font-style: normal; background: linear-gradient(135deg, #ff8a2a, #ffb347 55%, #c4b5fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lp-sub { margin: 18px auto 0; max-width: 620px; font-size: clamp(15px, 1.8vw, 18px); line-height: 1.6; color: rgba(255,255,255,.78); }

.lp-ask { margin: 30px auto 0; max-width: 620px; display: flex; gap: 8px; padding: 8px; border-radius: 18px; background: rgba(16,11,34,.82); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.lp-ask__field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 0 12px; }
.lp-ask__field svg { color: #ffb347; flex-shrink: 0; }
.lp-ask input { flex: 1; min-width: 0; height: 48px; border: 0; outline: none; background: transparent; color: #fff; font: inherit; font-size: 16px; }
.lp-ask input::placeholder { color: rgba(255,255,255,.45); }
.lp-ask__btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 0 20px; border: 0; border-radius: 12px; cursor: pointer; font: inherit; font-weight: 800; font-size: 15px; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); white-space: nowrap; }
.lp-ask__btn:focus-visible, .lp-btn:focus-visible, .lp-path:focus-visible { outline: 3px solid #ffb347; outline-offset: 3px; }
.lp-hint { margin-top: 12px; font-size: 13px; color: rgba(255,255,255,.55); }

.lp-trust { margin-top: 26px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; font-size: 13px; color: rgba(255,255,255,.7); }
.lp-trust span { display: inline-flex; align-items: center; gap: 6px; }
.lp-trust svg { color: #6ee7a8; }

/* Section heads */
.lp-section { padding: clamp(40px, 6vw, 72px) 0; }
.lp-label { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #ffb347; }
.lp-h2 { margin: 10px 0 0; font-family: "Playfair Display", "Syne", Georgia, serif; font-size: clamp(26px, 3.6vw, 40px); line-height: 1.12; font-weight: 800; }
.lp-lead { margin: 12px 0 0; max-width: 620px; font-size: 15.5px; line-height: 1.6; color: rgba(255,255,255,.72); }

/* Three ways to plan */
.lp-paths { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.lp-path { position: relative; display: flex; flex-direction: column; gap: 12px; text-align: left; padding: 24px; border-radius: 20px; cursor: pointer; font: inherit; color: #fff; background: rgba(16,11,34,.78); border: 1px solid rgba(255,255,255,.12); transition: transform .18s, border-color .18s, background .18s; }
.lp-path:hover { transform: translateY(-3px); border-color: rgba(255,138,42,.6); background: rgba(24,16,48,.9); }
.lp-path__icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ffb347; background: rgba(255,138,42,.14); border: 1px solid rgba(255,138,42,.3); }
.lp-path--atlas .lp-path__icon { color: #c4b5fd; background: rgba(124,92,252,.16); border-color: rgba(124,92,252,.4); }
.lp-path__title { font-size: 19px; font-weight: 800; }
.lp-path__text { font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.72); flex: 1; }
.lp-path__go { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; color: #ffb347; }
.lp-path--atlas .lp-path__go { color: #c4b5fd; }

/* Sync Together band */
.lp-sync { margin-top: 8px; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 28px; align-items: center; padding: clamp(24px, 4vw, 44px); border-radius: 26px; background: linear-gradient(135deg, rgba(255,138,42,.16), rgba(124,92,252,.18)); border: 1px solid rgba(255,179,71,.3); }
.lp-sync__badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.lp-sync__list { margin: 18px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.lp-sync__list li { display: flex; gap: 10px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,.85); }
.lp-sync__list svg { color: #ffb347; flex-shrink: 0; margin-top: 3px; }
.lp-sync__card { padding: 20px; border-radius: 18px; background: rgba(10,6,23,.72); border: 1px solid rgba(255,255,255,.12); }
.lp-sync__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,.08); font-size: 14px; }
.lp-sync__row:first-of-type { border-top: 0; }
.lp-sync__who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lp-sync__dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #1a0e06; flex-shrink: 0; }
.lp-sync__paid { font-size: 12px; font-weight: 800; color: #6ee7a8; }
.lp-sync__due { font-size: 12px; font-weight: 800; color: #ffc27a; }

/* Feature grid */
.lp-feats { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.lp-feat { padding: 22px; border-radius: 18px; background: rgba(16,11,34,.7); border: 1px solid rgba(255,255,255,.1); }
.lp-feat svg { color: #ffb347; }
.lp-feat h3 { margin: 12px 0 6px; font-size: 17px; font-weight: 800; }
.lp-feat p { margin: 0; font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.7); }
.lp-feat a { display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 14px; font-weight: 800; color: #ffb347; text-decoration: none; }
.lp-feat a:hover { color: #fff; }

/* Steps */
.lp-steps { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; counter-reset: step; }
.lp-step { padding: 22px; border-radius: 18px; border: 1px dashed rgba(255,255,255,.18); }
.lp-step__n { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.lp-step h3 { margin: 12px 0 6px; font-size: 16.5px; font-weight: 800; }
.lp-step p { margin: 0; font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.7); }

/* Final call to action */
.lp-cta { margin: 8px 0 clamp(48px, 7vw, 88px); text-align: center; padding: clamp(28px, 5vw, 52px) 24px; border-radius: 26px; background: rgba(16,11,34,.82); border: 1px solid rgba(255,255,255,.12); }
.lp-cta__btns { margin-top: 22px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border-radius: 999px; font: inherit; font-weight: 800; font-size: 15px; text-decoration: none; cursor: pointer; border: 1px solid transparent; }
.lp-btn--primary { color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.lp-btn--ghost { color: #fff; background: transparent; border-color: rgba(255,255,255,.3); }
.lp-btn--ghost:hover { border-color: #ffb347; color: #ffb347; }

@media (max-width: 900px) {
  .lp-paths, .lp-feats, .lp-steps { grid-template-columns: 1fr; }
  .lp-sync { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .lp-wrap { padding: 0 16px; }
  .lp-ask { flex-direction: column; padding: 10px; }
  .lp-ask__btn { width: 100%; }
  .lp-path, .lp-feat, .lp-step { padding: 18px; }
}
@media (max-width: 360px) {
  .lp-title { font-size: 32px; }
  .lp-kicker { font-size: 11px; letter-spacing: .06em; }
  .lp-btn { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-path { transition: none; }
  .lp-path:hover { transform: none; }
}
`;

const PATHS = [
  {
    key: "search",
    Icon: Search,
    title: "Search myself",
    text: "Pick your dates and compare flights and hotels side by side.",
    go: "Search flights & stays",
  },
  {
    key: "budget",
    Icon: Wallet,
    title: "Plan on a budget",
    text: "Set what you want to spend and see only the trips that fit.",
    go: "Set my budget",
  },
  {
    key: "atlas",
    Icon: Sparkles,
    title: "Let Atlas plan it",
    text: "Tell our AI the trip you want in your own words. It finds the options and books them with you.",
    go: "Ask Atlas",
  },
];

function openAtlas(message) {
  window.dispatchEvent(
    new CustomEvent("skyrio:open-atlas", {
      detail: message ? { mode: "chat", message } : { mode: "chat" },
    })
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isAuthed } = useAuth();
  const [where, setWhere] = useState("");
  const firstName = String(user?.name || user?.username || "")
    .trim()
    .split(/\s+/)[0];

  const choosePath = (key) => {
    if (key === "atlas") {
      openAtlas();
      return;
    }
    try {
      localStorage.setItem(PLAN_MODE_KEY, key);
    } catch {
      /* private mode: the booking page just opens on search */
    }
    navigate("/booking");
  };

  const ask = (e) => {
    e.preventDefault();
    const place = where.trim();
    openAtlas(
      place
        ? `Help me plan a trip to ${place}. Show me flights and places to stay.`
        : undefined
    );
  };

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <span className="lp-kicker">
            <Compass size={14} aria-hidden="true" />
            {isAuthed && firstName
              ? `Welcome back, ${firstName}`
              : "AI-native travel booking"}
          </span>
          <h1 className="lp-title">
            Plan smarter. <em>Travel better.</em>
          </h1>
          <p className="lp-sub">
            Book flights and hotels, plan group trips where everyone pays their
            own share, and earn XP on every trip, all in one place.
          </p>

          <form className="lp-ask" onSubmit={ask} role="search">
            <label className="lp-ask__field">
              <Plane size={18} aria-hidden="true" />
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                }}
              >
                Where do you want to go?
              </span>
              <input
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Where do you want to go?"
                autoComplete="off"
                maxLength={80}
              />
            </label>
            <button type="submit" className="lp-ask__btn">
              <Sparkles size={16} aria-hidden="true" /> Plan with Atlas
            </button>
          </form>
          <div className="lp-hint">
            Or{" "}
            <Link to="/booking" style={{ color: "#ffb347", fontWeight: 700 }}>
              search flights and hotels yourself
            </Link>
            .
          </div>

          <div className="lp-trust">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Secure checkout
            </span>
            <span>
              <CalendarX2 size={15} aria-hidden="true" /> See your refund before
              you cancel
            </span>
            <span>
              <Users size={15} aria-hidden="true" /> Book with or without an
              account
            </span>
          </div>
        </div>
      </section>

      {/* ── Three ways to plan ── */}
      <section className="lp-section" aria-labelledby="lp-paths-title">
        <div className="lp-wrap">
          <div className="lp-label">Start your trip</div>
          <h2 className="lp-h2" id="lp-paths-title">
            Three ways to plan. Pick yours.
          </h2>
          <div className="lp-paths">
            {PATHS.map(({ key, Icon, title, text, go }) => (
              <button
                key={key}
                type="button"
                className={`lp-path${key === "atlas" ? " lp-path--atlas" : ""}`}
                onClick={() => choosePath(key)}
              >
                <span className="lp-path__icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span className="lp-path__title">{title}</span>
                <span className="lp-path__text">{text}</span>
                <span className="lp-path__go">
                  {go} <ArrowRight size={15} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sync Together ── */}
      <section className="lp-section" aria-labelledby="lp-sync-title">
        <div className="lp-wrap">
          <div className="lp-sync">
            <div>
              <span className="lp-sync__badge">
                <Users size={13} aria-hidden="true" /> Group trips
              </span>
              <h2 className="lp-h2" id="lp-sync-title">
                Sync Together: plan with friends, pay your own share.
              </h2>
              <ul className="lp-sync__list">
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Invite friends with one link. They can join from any phone.
                </li>
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Pick flights and a place to stay together.
                </li>
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Everyone pays their own part. No chasing people for money.
                </li>
              </ul>
              <div
                className="lp-cta__btns"
                style={{ justifyContent: "flex-start" }}
              >
                <Link to="/sync-together" className="lp-btn lp-btn--primary">
                  Start a group trip <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="lp-sync__card" aria-hidden="true">
              <div className="lp-label" style={{ marginBottom: 8 }}>
                Weekend in Miami · 4 travelers
              </div>
              {[
                ["A", "#ffb347", "Alex", true],
                ["J", "#c4b5fd", "Jordan", true],
                ["S", "#6ee7a8", "Sam", false],
                ["R", "#ff9db0", "Riley", true],
              ].map(([i, bg, name, paid]) => (
                <div key={name} className="lp-sync__row">
                  <span className="lp-sync__who">
                    <span className="lp-sync__dot" style={{ background: bg }}>
                      {i}
                    </span>
                    {name}
                  </span>
                  {paid ? (
                    <span className="lp-sync__paid">Paid</span>
                  ) : (
                    <span className="lp-sync__due">Share pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Skyrio ── */}
      <section className="lp-section" aria-labelledby="lp-feats-title">
        <div className="lp-wrap">
          <div className="lp-label">Why Skyrio</div>
          <h2 className="lp-h2" id="lp-feats-title">
            More than a booking site.
          </h2>
          <div className="lp-feats">
            <div className="lp-feat">
              <Award size={24} aria-hidden="true" />
              <h3>Digital Passport &amp; XP</h3>
              <p>
                Every trip earns XP and stamps. Climb the ranks and spend XP on
                rewards.
              </p>
              <Link to="/passport">
                {isAuthed ? "Open my Passport" : "See the Passport"}{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="lp-feat">
              <Globe2 size={24} aria-hidden="true" />
              <h3>SkyHub</h3>
              <p>
                Real trips from real travelers. Get ideas, share your own and
                find people going where you are.
              </p>
              <Link to="/skyhub">
                Explore SkyHub <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="lp-feat">
              <CalendarX2 size={24} aria-hidden="true" />
              <h3>Change of plans? Easy.</h3>
              <p>
                Cancel a flight or hotel in a few taps. You see exactly what you
                get back before anything is cancelled.
              </p>
              <Link to={isAuthed ? "/saved-trips" : "/find-booking"}>
                {isAuthed ? "Go to My trips" : "Find my booking"}{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section" aria-labelledby="lp-steps-title">
        <div className="lp-wrap">
          <div className="lp-label">How it works</div>
          <h2 className="lp-h2" id="lp-steps-title">
            From idea to boarding pass.
          </h2>
          <div className="lp-steps">
            <div className="lp-step">
              <span className="lp-step__n">1</span>
              <h3>Find your trip</h3>
              <p>
                Search, set a budget or just tell Atlas where you want to go.
              </p>
            </div>
            <div className="lp-step">
              <span className="lp-step__n">2</span>
              <h3>Book in minutes</h3>
              <p>
                Choose your seat and room, then pay securely. Your confirmation
                arrives by email.
              </p>
            </div>
            <div className="lp-step">
              <span className="lp-step__n">3</span>
              <h3>Travel and earn</h3>
              <p>
                Manage everything in My trips and earn XP toward your next
                adventure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final call to action ── */}
      <section className="lp-wrap">
        <div className="lp-cta">
          <h2 className="lp-h2">
            {isAuthed ? "Where to next?" : "Your next trip starts here."}
          </h2>
          <p className="lp-lead" style={{ margin: "12px auto 0" }}>
            {isAuthed
              ? "Book your next flight or hotel, or let Atlas plan it for you."
              : "Create a free account to earn XP and plan group trips, or book as a guest. No account needed."}
          </p>
          <div className="lp-cta__btns">
            <Link to="/booking" className="lp-btn lp-btn--primary">
              <Plane size={16} aria-hidden="true" /> Book a flight
            </Link>
            <Link to="/booking" className="lp-btn lp-btn--ghost">
              <BedDouble size={16} aria-hidden="true" /> Find a hotel
            </Link>
            {!isAuthed && (
              <Link to="/register" className="lp-btn lp-btn--ghost">
                <Send size={16} aria-hidden="true" /> Create free account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
