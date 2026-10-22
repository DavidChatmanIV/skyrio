// Skyrio welcome tour.
//
// • Shows once for new visitors (a couple of seconds after the page settles),
//   never on login / checkout / admin pages.
// • Finishing, closing or "Skip tour" all remember the choice, so it doesn't
//   come back on every page load.
// • Replay it from anywhere (e.g. a "Take the tour" link in Help):
//     window.dispatchEvent(new Event("skyrio:tour"))
// • Keyboard: ← / → to move, Esc to close. Focus stays inside the card.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

const STORAGE_KEY = "skyrio_tour_done";
const START_DELAY_MS = 2500;
// Pages where a tour popping up would get in the way
const BLOCKED_PATHS = [
  /^\/login/,
  /^\/register/,
  /^\/reset/,
  /^\/verify/,
  /^\/admin/,
  /checkout/,
  /^\/booking\/confirm/,
];

/* ── Icons (stroke SVG — same family as the navbar) ───────────────── */
function Svg({ size = 26, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const Icon = {
  plane: (p) => (
    <Svg {...p}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </Svg>
  ),
  discover: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Svg>
  ),
  book: (p) => (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" />
      <path d="M15 5v14" strokeDasharray="2 2.5" />
    </Svg>
  ),
  skyhub: (p) => (
    <Svg {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M13 8v8M15.5 8.5h3v3h-3zM5.5 10h5M5.5 13h5" />
    </Svg>
  ),
  passport: (p) => (
    <Svg {...p}>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16.5h6" />
    </Svg>
  ),
  group: (p) => (
    <Svg {...p}>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
    </Svg>
  ),
  check: (p) => (
    <Svg {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  ),
  tip: (p) => (
    <Svg {...p}>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
    </Svg>
  ),
  close: (p) => (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  ),
  left: (p) => (
    <Svg {...p}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  ),
  right: (p) => (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  ),
};

/* ── Steps — only things Skyrio actually does today ───────────────── */
const STEPS = [
  {
    icon: "plane",
    kicker: "Welcome aboard",
    title: "Welcome to Skyrio",
    body: "Plan, book and share your trips in one place. Here's a quick look at the four main sections. It takes about a minute.",
    points: [
      { icon: "discover", text: "Discover: plan a trip with Atlas AI" },
      { icon: "book", text: "Book: search flights and hotels" },
      { icon: "skyhub", text: "SkyHub: see and share travel tips" },
      { icon: "passport", text: "Passport: your XP, rank and trips" },
    ],
  },
  {
    icon: "discover",
    kicker: "Discover",
    title: "Tell Atlas where you want to go",
    body: "Type a destination and a budget in plain words, like “a warm beach trip in March under $1,500.” Atlas suggests a flight + hotel plan, then you see live prices before you book.",
    tip: "Tap the Atlas AI button in the corner of any page to ask a question.",
    path: "/",
    cta: "Open Discover",
  },
  {
    icon: "book",
    kicker: "Book",
    title: "Search flights and hotels",
    body: "Fill in your boarding pass (where, when, who) and search. Prices are live, and checkout shows exactly what you'll pay before you pay it.",
    tip: "Tap the heart on a trip to save it for later. Your saved trips live under the heart in the menu.",
    path: "/booking",
    cta: "Open Book",
  },
  {
    icon: "skyhub",
    kicker: "SkyHub",
    title: "Share your trip as a postcard",
    body: "SkyHub is where Skyrio travelers post tips, photos and questions about places they've been. Read what others found, follow travelers you like, or post your own.",
    tip: "Add the place to your post so travelers nearby can find it.",
    path: "/skyhub",
    cta: "Open SkyHub",
  },
  {
    icon: "passport",
    kicker: "Passport",
    title: "Earn XP and climb the ranks",
    body: "Your Digital Passport tracks your trips, XP and rank. Booking trips earns the most XP; posting on SkyHub earns some too.",
    points: [
      { icon: "check", text: "Booking XP unlocks once your trip starts" },
      { icon: "check", text: "Spend XP on rewards in Passport Rewards" },
      { icon: "check", text: "Spending XP never lowers your rank" },
    ],
    path: "/passport",
    cta: "Open Passport",
  },
  {
    icon: "group",
    kicker: "Sync Together",
    title: "Plan a trip with friends",
    body: "Start a group trip, suggest flights and hotels for everyone to vote on, and keep it all in one place. Each person books and pays for their own part, so nobody has to front the whole trip.",
    tip: "Find Sync Together in your Passport.",
    path: "/sync-together",
    cta: "Open Sync Together",
  },
  {
    icon: "plane",
    kicker: "You're all set",
    title: "Ready when you are",
    body: "Start with a destination and Atlas will take it from there. You can replay this tour any time from Help.",
    isLast: true,
  },
];

/* ── Styles ───────────────────────────────────────────────────────── */
const TOUR_CSS = `
.st-scrim { position: fixed; inset: 0; z-index: 2147483646; background: rgba(5,3,12,0.72); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: stFade .25s ease both; }
.st-card { position: relative; width: 100%; max-width: 460px; max-height: calc(100dvh - 32px); overflow-y: auto; overscroll-behavior: contain; border-radius: 24px; background: radial-gradient(120% 90% at 100% 0%, rgba(255,107,43,0.14), transparent 55%), radial-gradient(100% 90% at 0% 100%, rgba(139,108,255,0.16), transparent 60%), rgba(16,11,34,0.98); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06); color: #fff; font-family: "DM Sans", system-ui, sans-serif; animation: stIn .3s cubic-bezier(.22,1,.36,1) both; }
.st-card:focus { outline: none; }
.st-card button { all: unset; box-sizing: border-box; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.st-card button:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }

.st-progress { position: sticky; top: 0; z-index: 1; height: 3px; background: rgba(255,255,255,0.08); }
.st-progress span { display: block; height: 100%; background: linear-gradient(90deg,#ff8a2a,#ffb347,#8b6cff); border-radius: 0 3px 3px 0; transition: width .35s ease; }

.st-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 16px 0 22px; }
.st-kicker { font-family: ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #ffb347; }
.st-card .st-close { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; color: rgba(255,255,255,0.7); }
.st-card .st-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

.st-body { padding: 14px 22px 0; }
.st-hero { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.st-badge { flex-shrink: 0; width: 58px; height: 58px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: #ffb347; background: linear-gradient(135deg, rgba(255,138,42,0.2), rgba(139,108,255,0.18)); border: 1px solid rgba(255,138,42,0.35); box-shadow: 0 8px 24px rgba(255,138,42,0.18); }
.st-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.st-text { margin: 0 0 14px; font-size: 14.5px; line-height: 1.6; color: rgba(255,255,255,0.82); }

.st-points { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.st-points li { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-size: 13.5px; color: rgba(255,255,255,0.88); }
.st-points li svg { color: #ffb347; flex-shrink: 0; }

.st-tip { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; margin-bottom: 14px; border-radius: 12px; background: rgba(255,138,42,0.09); border: 1px dashed rgba(255,138,42,0.4); font-size: 13px; line-height: 1.5; color: #ffd2a3; }
.st-tip svg { flex-shrink: 0; margin-top: 1px; color: #ffb347; }

.st-card .st-goto { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 13px; font-weight: 700; color: #ffb347; border-bottom: 1px solid rgba(255,179,71,0.4); padding-bottom: 1px; }
.st-card .st-goto:hover { color: #fff; border-color: #fff; }

.st-foot { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; padding: 14px 22px calc(18px + env(safe-area-inset-bottom, 0px)); border-top: 1px dashed rgba(255,255,255,0.14); background: rgba(16,11,34,0.96); }
.st-dots { display: flex; gap: 6px; align-items: center; }
.st-card .st-dot { width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.22); transition: width .25s ease, background .25s ease; }
.st-card .st-dot.is-done { background: rgba(139,108,255,0.8); }
.st-card .st-dot.is-on { width: 22px; background: #ff8a2a; }
.st-btns { display: flex; gap: 8px; }
.st-card .st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 46px; padding: 0 18px; border-radius: 999px; font-size: 14.5px; font-weight: 800; white-space: nowrap; }
.st-card .st-btn.is-ghost { min-width: 46px; padding: 0 12px; color: rgba(255,255,255,0.82); border: 1px solid rgba(255,255,255,0.18); }
.st-card .st-btn.is-ghost:hover { border-color: rgba(255,138,42,0.5); color: #ffb347; }
.st-card .st-btn.is-primary { color: #1a0e06; background: linear-gradient(135deg,#ff8a2a,#ffb347); box-shadow: 0 8px 22px rgba(255,138,42,0.35); }
.st-card .st-btn.is-primary:hover { filter: brightness(1.06); }

.st-lastBtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
.st-card .st-lastBtns .st-btn { width: 100%; }

.st-card .st-skip { display: block; margin: 14px 0 0; padding: 8px 12px; font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.6); }
.st-card .st-skip:hover { color: #fff; }
.st-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 560px) {
  .st-scrim { align-items: flex-end; padding: 0; }
  .st-card { max-width: none; max-height: 92dvh; border-radius: 24px 24px 0 0; animation-name: stUp; }
  .st-title { font-size: 20px; }
  .st-badge { width: 50px; height: 50px; border-radius: 15px; }
  .st-lastBtns { grid-template-columns: 1fr; }
}
@keyframes stFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes stIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes stUp { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .st-scrim, .st-card { animation: none; }
  .st-progress span, .st-card .st-dot { transition: none; }
}
`;

const readDone = () => {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return true; // storage blocked — don't nag
  }
};
const saveDone = () => {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* fine */
  }
};

/* ── Component ────────────────────────────────────────────────────── */
export default function SkyrioDTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const cardRef = useRef(null);
  const lastFocus = useRef(null);

  const blocked = BLOCKED_PATHS.some((re) => re.test(location.pathname));

  // First visit: show once the page has settled
  useEffect(() => {
    if (visible || blocked || readDone()) return;
    const t = setTimeout(() => {
      lastFocus.current = document.activeElement;
      setStep(0);
      setVisible(true);
    }, START_DELAY_MS);
    return () => clearTimeout(t);
  }, [blocked, visible]);

  // Replay on demand
  useEffect(() => {
    const replay = () => {
      lastFocus.current = document.activeElement;
      setStep(0);
      setVisible(true);
    };
    window.addEventListener("skyrio:tour", replay);
    return () => window.removeEventListener("skyrio:tour", replay);
  }, []);

  const close = useCallback(() => {
    saveDone();
    setVisible(false);
    setTimeout(() => lastFocus.current?.focus?.(), 0);
  }, []);

  const go = (path) => {
    close();
    if (path && path !== location.pathname) navigate(path);
  };

  const next = useCallback(
    () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
    []
  );
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Lock the page, keyboard controls, keep focus inside the card
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => cardRef.current?.focus(), 30);

    const onKey = (e) => {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowRight") return next();
      if (e.key === "ArrowLeft") return prev();
      if (e.key !== "Tab" || !cardRef.current) return;
      const els = cardRef.current.querySelectorAll(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, close, next, prev]);

  // Move focus to the card on each step so screen readers read it
  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [step, visible]);

  if (!visible) return null;

  const s = STEPS[step];
  const HeroIcon = Icon[s.icon];
  const progress = ((step + 1) / STEPS.length) * 100;

  return createPortal(
    <div
      className="st-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <style>{TOUR_CSS}</style>
      <div
        ref={cardRef}
        className="st-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-title"
        aria-describedby="st-text"
        tabIndex={-1}
      >
        <div className="st-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="st-top">
          <span className="st-kicker">
            {s.kicker}
            <span className="st-sr">
              {" "}
              — step {step + 1} of {STEPS.length}
            </span>
          </span>
          <button
            type="button"
            className="st-close"
            onClick={close}
            aria-label="Close tour"
          >
            <Icon.close size={20} />
          </button>
        </div>

        <div className="st-body" key={step}>
          <div className="st-hero">
            <span className="st-badge">
              <HeroIcon size={28} />
            </span>
            <h2 className="st-title" id="st-title">
              {s.title}
            </h2>
          </div>

          <p className="st-text" id="st-text">
            {s.body}
          </p>

          {s.points && (
            <ul className="st-points">
              {s.points.map((p) => {
                const PIcon = Icon[p.icon];
                return (
                  <li key={p.text}>
                    <PIcon size={17} />
                    {p.text}
                  </li>
                );
              })}
            </ul>
          )}

          {s.tip && (
            <div className="st-tip">
              <Icon.tip size={17} />
              <span>{s.tip}</span>
            </div>
          )}

          {s.path && (
            <button
              type="button"
              className="st-goto"
              onClick={() => go(s.path)}
            >
              {s.cta} <Icon.right size={14} />
            </button>
          )}

          {!s.isLast && (
            <button type="button" className="st-skip" onClick={close}>
              Skip tour
            </button>
          )}

          {s.isLast && (
            <div className="st-lastBtns">
              <button
                type="button"
                className="st-btn is-primary"
                onClick={() => go("/")}
              >
                Plan my first trip
              </button>
              <button
                type="button"
                className="st-btn is-ghost"
                onClick={() => go("/skyhub")}
              >
                Explore SkyHub
              </button>
            </div>
          )}
        </div>

        <div className="st-foot">
          <div className="st-dots" role="tablist" aria-label="Tour steps">
            {STEPS.map((st, i) => (
              <button
                key={st.title}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}: ${st.kicker}`}
                className={`st-dot${i === step ? " is-on" : ""}${
                  i < step ? " is-done" : ""
                }`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>
          <div className="st-btns">
            {step > 0 && (
              <button
                type="button"
                className="st-btn is-ghost"
                onClick={prev}
                aria-label="Previous step"
              >
                <Icon.left size={18} />
              </button>
            )}
            {s.isLast ? (
              <button type="button" className="st-btn is-ghost" onClick={close}>
                Close
              </button>
            ) : (
              <button
                type="button"
                className="st-btn is-primary"
                onClick={next}
              >
                {step === 0 ? "Show me around" : "Next"}
                <Icon.right size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
