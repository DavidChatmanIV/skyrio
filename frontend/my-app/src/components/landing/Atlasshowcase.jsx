import React, { useEffect, useRef, useState } from "react";
import "@/styles/AtlasShowcase.css";

/**
 * "Say hello to Atlas" section for the landing page.
 *
 * Goal: explain what Atlas does WITHOUT looking like a second place to type.
 * - The example chat is clearly labeled as a preview and has no input box.
 * - Every "try it" action opens the real Atlas (the floating button in the
 *   bottom-right corner) through a window event, so there is only ever one
 *   real Atlas on the page.
 *
 * The floating Atlas component needs a small listener for "skyrio:open-atlas"
 * (see the note at the bottom of this file).
 */

export function openAtlas(mode = "chat") {
  const detail = { mode, handled: false };
  window.dispatchEvent(new CustomEvent("skyrio:open-atlas", { detail }));
  if (detail.handled) return;

  // Fallback until the floating Atlas listens for the event:
  // find the bottom-right "Atlas AI" button and click it.
  const fab = [...document.querySelectorAll("button, [role='button']")].find(
    (el) => !el.closest(".atl") && /atlas ai/i.test(el.textContent || "")
  );
  fab?.click();
}

// Example conversation. No prices or cancellation promises — those depend on
// the real booking.
const EXAMPLE_CHAT = (homeCity) => [
  {
    id: 1,
    from: "user",
    text: "I want to go somewhere warm in March, budget around $1,800.",
  },
  {
    id: 2,
    from: "atlas",
    text: `Good timing. A few warm places fit that budget from ${homeCity}. I'll pull live flight and hotel prices so you can compare them side by side.`,
  },
  { id: 3, from: "user", text: "Can you find a hotel near the beach?" },
  {
    id: 4,
    from: "atlas",
    text: "Sure. I'll show beachfront hotels that fit what's left of your budget, so you can pick the one you like.",
  },
  {
    id: 5,
    from: "user",
    text: "What if something comes up and I need to cancel later?",
  },
  {
    id: 6,
    from: "atlas",
    text: "Every flight and hotel has its own cancellation rules, so check the policy on yours before you pay. If you need to cancel later, I can help you with it.",
  },
];

const MODES = [
  {
    key: "chat",
    icon: "chat",
    title: "Chat",
    desc: "Plan, price, and book flights and hotels. Get help changing or canceling a trip.",
    cta: "Open Chat",
  },
  {
    key: "compass",
    icon: "compass",
    title: "Compass",
    desc: "Type a city and get the highlights: best time to visit and top things to do. Nothing to book.",
    cta: "Open Compass",
  },
];

const FEATURES = [
  {
    icon: "spark",
    title: "Talk like you normally would",
    desc: "Say what you want in plain words. No forms or filters to fill in.",
  },
  {
    icon: "bolt",
    title: "Builds the plan for you",
    desc: "Flights, hotels, and a budget breakdown in one place.",
  },
  {
    icon: "check",
    title: "Books it with you",
    desc: "Go from idea to confirmed booking without leaving Skyrio.",
  },
  {
    icon: "headset",
    title: "Helps after you book",
    desc: "Need to change or cancel, or have a refund question? Ask Atlas.",
  },
];

/* ── Icons (stroke style to match the rest of the landing page) ── */
function Svg({ size = 18, children, fill = "none" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

function RobotIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
      <rect x="8" y="5.5" width="8" height="5.5" rx="2" opacity=".9" />
      <circle cx="10" cy="14" r="1.5" fill="#FFD060" />
      <circle cx="14" cy="14" r="1.5" fill="#FFD060" />
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3" r="1.3" />
    </svg>
  );
}

const ICONS = {
  chat: (s) => (
    <Svg size={s}>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
    </Svg>
  ),
  compass: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z" />
    </Svg>
  ),
  spark: (s) => (
    <Svg size={s}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Svg>
  ),
  bolt: (s) => (
    <Svg size={s}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </Svg>
  ),
  check: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </Svg>
  ),
  headset: (s) => (
    <Svg size={s}>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2ZM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2Z" />
    </Svg>
  ),
  info: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </Svg>
  ),
  arrowDownRight: (s) => (
    <Svg size={s}>
      <path d="M7 7l10 10M17 9v8H9" />
    </Svg>
  ),
  arrowRight: (s) => (
    <Svg size={s}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
};
const Icon = ({ name, size = 18 }) => (ICONS[name] ? ICONS[name](size) : null);

/* ── Starts once the section scrolls into view ── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function AtlasShowcase({ homeCity = "your city" }) {
  const [sectionRef, inView] = useInView();
  const chat = EXAMPLE_CHAT(homeCity);
  const [shown, setShown] = useState(1);

  // Play the example conversation once the section is visible.
  useEffect(() => {
    if (!inView || shown >= chat.length) return;
    const t = setTimeout(
      () => setShown((n) => n + 1),
      shown === 1 ? 1200 : 1600
    );
    return () => clearTimeout(t);
  }, [inView, shown, chat.length]);

  const nextIsAtlas = shown < chat.length && chat[shown]?.from === "atlas";

  return (
    <section
      ref={sectionRef}
      className={`atl${inView ? " is-in" : ""}`}
      aria-labelledby="atl-title"
    >
      {/* ── Heading ── */}
      <header className="atl__head">
        <div className="atl__eyebrow">
          <Icon name="spark" size={12} /> Meet your travel companion
        </div>
        <h2 id="atl-title" className="atl__title">
          Say hello to <span>Atlas</span>
        </h2>
        <p className="atl__sub">
          Your AI travel assistant. Atlas plans your trip, books it with you,
          and helps after you book.
        </p>

        {/* Where Atlas actually lives */}
        <div className="atl__locate">
          <div className="atl__locateText">
            <span className="atl__fabChip" aria-hidden="true">
              <RobotIcon size={15} /> Atlas AI
            </span>
            <span>
              Atlas is always in the <strong>bottom-right corner</strong> of
              every page. Tap it anytime to start.
            </span>
            <span className="atl__locateArrow" aria-hidden="true">
              <Icon name="arrowDownRight" size={16} />
            </span>
          </div>
          <button
            type="button"
            className="atl__btn atl__btn--primary"
            onClick={() => openAtlas("chat")}
          >
            Open Atlas <Icon name="arrowRight" size={15} />
          </button>
        </div>
      </header>

      {/* ── Two ways to use it ── */}
      <div className="atl__modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className="atl__mode"
            onClick={() => openAtlas(m.key)}
          >
            <span className="atl__iconBox">
              <Icon name={m.icon} size={18} />
            </span>
            <span className="atl__modeText">
              <span className="atl__modeTitle">{m.title}</span>
              <span className="atl__modeDesc">{m.desc}</span>
              <span className="atl__modeCta">
                {m.cta} <Icon name="arrowRight" size={13} />
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Example chat + what it does ── */}
      <div className="atl__body">
        <figure
          className="atl__preview"
          aria-label="Example conversation with Atlas"
        >
          <div className="atl__previewHead">
            <span className="atl__avatar">
              <RobotIcon size={18} />
            </span>
            <span className="atl__previewName">Atlas</span>
            <span className="atl__tag">Example conversation</span>
          </div>

          <div className="atl__messages">
            {chat.slice(0, shown).map((b) => (
              <div key={b.id} className={`atl__bubble atl__bubble--${b.from}`}>
                {b.from === "atlas" && (
                  <span className="atl__bubbleAvatar">
                    <RobotIcon size={12} />
                  </span>
                )}
                <p className="atl__bubbleText">{b.text}</p>
              </div>
            ))}
            {inView && nextIsAtlas && (
              <div
                className="atl__bubble atl__bubble--atlas"
                aria-hidden="true"
              >
                <span className="atl__bubbleAvatar">
                  <RobotIcon size={12} />
                </span>
                <span className="atl__typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>

          {/* No input box here on purpose — it's only a preview */}
          <figcaption className="atl__previewFoot">
            <Icon name="info" size={15} />
            <span>
              This is a sample. To ask Atlas for real, use the{" "}
              <strong>Atlas AI</strong> button in the bottom-right corner.
            </span>
            <button
              type="button"
              className="atl__btn atl__btn--ghost"
              onClick={() => openAtlas("chat")}
            >
              Try it
            </button>
          </figcaption>
        </figure>

        <ul className="atl__features">
          {FEATURES.map((f) => (
            <li key={f.title} className="atl__feature">
              <span className="atl__iconBox">
                <Icon name={f.icon} size={18} />
              </span>
              <span>
                <span className="atl__featureTitle">{f.title}</span>
                <span className="atl__featureDesc">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/*
 * In the floating Atlas component (the bottom-right button), add:
 *
 *   useEffect(() => {
 *     const onOpen = (e) => {
 *       e.detail.handled = true;                    // skip the fallback click
 *       setOpen(true);                              // your open state
 *       if (e.detail?.mode) setMode(e.detail.mode); // "chat" | "compass"
 *     };
 *     window.addEventListener("skyrio:open-atlas", onOpen);
 *     return () => window.removeEventListener("skyrio:open-atlas", onOpen);
 *   }, []);
 */
