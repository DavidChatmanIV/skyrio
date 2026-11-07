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
// Copy rule (from testers: "people don't read"): headlines 3–6 words, one
// short line under each, buttons that say what happens.
//
// The page follows the time of day (the visitor's own clock): morning,
// afternoon, evening and night each get their own sky tint, sun/moon,
// greeting and Atlas ideas. It checks again every minute, so it changes
// while the page is open. Preview any of them with ?time=morning /
// afternoon / evening / night.
//
// Self-contained: its own styles (lp- prefix), lucide icons only (no
// emoji), works signed in or as a guest. The cosmic background comes from
// AppLayout (osq-shell--landing); the time-of-day tint sits on top of it.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  ShieldCheck,
  Send,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Armchair,
  UserCheck,
  MessageSquareHeart,
  Search as FindIcon,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";

// Same key BookingPage reads, so the chosen path opens ready to go.
const PLAN_MODE_KEY = "skyrio_plan_mode";

/* ── Time of day ───────────────────────────────────────────── */
const TIMES = {
  morning: {
    hours: "5am–noon",
    Icon: Sunrise,
    hello: "Good morning",
    line: "Fresh day, fresh fares.",
    ideas: ["Weekend getaway", "Cheap flight this month", "Under 3 hours away"],
  },
  afternoon: {
    hours: "noon–5pm",
    Icon: Sun,
    hello: "Good afternoon",
    line: "Daydreaming? Make it a trip.",
    ideas: [
      "Somewhere warm now",
      "Beach trip under $600",
      "City break, great food",
    ],
  },
  evening: {
    hours: "5pm–9pm",
    Icon: Sunset,
    hello: "Good evening",
    line: "Golden hour. Plan with friends.",
    ideas: [
      "Group trip with friends",
      "Last-minute weekend",
      "Getaway for two",
    ],
  },
  night: {
    hours: "9pm–5am",
    Icon: Moon,
    hello: "Up late",
    line: "Dream tonight. Book tomorrow.",
    ideas: ["Red-eye flights", "Dream trip next year", "Somewhere quiet"],
  },
};
function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
// Follows the clock, re-checked every minute. ?time=night previews one.
function useTimeOfDay() {
  const { search } = useLocation();
  const forced = new URLSearchParams(search).get("time");
  const [now, setNow] = useState(() => timeOfDay());
  useEffect(() => {
    const id = setInterval(() => setNow(timeOfDay()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return TIMES[forced] ? forced : now;
}

/* What's new on Skyrio (shipped from tester feedback). */
const NEW_THINGS = [
  {
    Icon: UserCheck,
    title: "Book as a guest",
    text: "No account needed.",
  },
  {
    Icon: Armchair,
    title: "Pick your seat",
    text: "Choose it before you pay.",
  },
  {
    Icon: FindIcon,
    title: "Find my booking",
    text: "Email + code. View or cancel.",
    to: "/find-booking",
  },
  {
    Icon: MessageSquareHeart,
    title: "Tell us anything",
    text: "We read every message.",
  },
];

const CSS = `
.lp { position: relative; overflow: hidden; color: #fff; font-family: "DM Sans", system-ui, sans-serif; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, rgba(10,6,23,.3) 0%, rgba(10,6,23,.3) 82%, rgba(10,6,23,0) 100%), var(--lp-sky); transition: background 1.2s ease; }
.lp > * { position: relative; z-index: 1; }

/* Skyrio glass: the same see-through purple panels, soft blur and
   orange-to-purple top line as the navbar, instead of flat black. */
.lp { --lp-glass: linear-gradient(160deg, rgba(74,40,112,.58) 0%, rgba(34,18,62,.66) 100%); --lp-glass-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 18px 44px rgba(12,4,28,.38); }
.lp-path, .lp-feat, .lp-step, .lp-newItem, .lp-cta {
  position: relative; overflow: hidden;
  background: var(--lp-glass);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: var(--lp-glass-shadow);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.lp-path::before, .lp-feat::before, .lp-step::before, .lp-cta::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc);
  opacity: .85;
}
/* No blur support: a solid version of the same purple. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lp { --lp-glass: linear-gradient(160deg, rgba(56,30,88,.95), rgba(28,14,52,.96)); }
}

/* Sky tint over the site's cosmic background, one per time of day.
   Text sits on solid cards, so the tint can stay light. It fades out at
   the bottom so the page blends into the site background (no hard dark
   edge above the footer). */
.lp--morning   { --lp-sky: linear-gradient(180deg, rgba(255,190,130,.28) 0%, rgba(120,70,120,.38) 18%, rgba(12,8,28,.55) 45%, rgba(12,8,28,.55) 78%, rgba(12,8,28,0) 100%); --lp-accent: #ffb347; --lp-glow: rgba(255,200,120,.55); }
.lp--afternoon { --lp-sky: linear-gradient(180deg, rgba(110,170,255,.28) 0%, rgba(90,90,190,.38) 18%, rgba(12,8,28,.55) 45%, rgba(12,8,28,.55) 78%, rgba(12,8,28,0) 100%); --lp-accent: #7cc4ff; --lp-glow: rgba(255,236,170,.6); }
.lp--evening   { --lp-sky: linear-gradient(180deg, rgba(255,110,80,.30) 0%, rgba(150,60,130,.40) 18%, rgba(14,8,30,.55) 45%, rgba(14,8,30,.55) 78%, rgba(14,8,30,0) 100%); --lp-accent: #ff8a5c; --lp-glow: rgba(255,140,80,.6); }
.lp--night     { --lp-sky: linear-gradient(180deg, rgba(30,30,90,.55) 0%, rgba(14,10,40,.7) 25%, rgba(8,5,20,.72) 60%, rgba(8,5,20,.5) 85%, rgba(8,5,20,0) 100%); --lp-accent: #c4b5fd; --lp-glow: rgba(220,220,255,.45); }

/* Sun or moon behind the hero */
.lp-orb { position: absolute; z-index: 0; pointer-events: none; top: 24px; right: 2vw; width: clamp(90px, 11vw, 150px); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 40% 40%, #fff6dc, var(--lp-glow) 45%, transparent 70%); filter: blur(1px); opacity: .9; }
.lp--morning .lp-orb { top: 60px; }
.lp--evening .lp-orb { top: 90px; background: radial-gradient(circle at 50% 50%, #ffd9a8, var(--lp-glow) 45%, transparent 70%); }
.lp--night .lp-orb { width: clamp(70px, 8vw, 110px); background: radial-gradient(circle at 35% 35%, #f5f3ff 0 38%, rgba(220,220,255,.25) 52%, transparent 70%); box-shadow: 0 0 80px rgba(196,181,253,.35); }
/* Stars at night */
.lp-stars { position: absolute; z-index: 0; inset: 0 0 auto 0; height: 900px; pointer-events: none; opacity: 0; transition: opacity 1.2s; background-image:
  radial-gradient(1.5px 1.5px at 12% 18%, #fff, transparent),
  radial-gradient(1px 1px at 28% 32%, #fff, transparent),
  radial-gradient(1.5px 1.5px at 45% 12%, #fff, transparent),
  radial-gradient(1px 1px at 63% 26%, #fff, transparent),
  radial-gradient(1.5px 1.5px at 78% 40%, #fff, transparent),
  radial-gradient(1px 1px at 88% 14%, #fff, transparent),
  radial-gradient(1px 1px at 8% 48%, #fff, transparent),
  radial-gradient(1.5px 1.5px at 36% 55%, #fff, transparent),
  radial-gradient(1px 1px at 70% 62%, #fff, transparent),
  radial-gradient(1px 1px at 92% 70%, #fff, transparent); }
.lp--night .lp-stars { opacity: .8; }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

/* Hero */
.lp-hero { padding: clamp(48px, 9vw, 110px) 0 clamp(36px, 6vw, 64px); text-align: center; }
.lp-kicker { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--lp-accent); background: rgba(10,6,23,.55); border: 1px solid rgba(255,255,255,.22); }
.lp-title { margin: 18px auto 0; max-width: 860px; font-family: "Playfair Display", "Syne", Georgia, serif; font-size: clamp(36px, 6.4vw, 72px); line-height: 1.04; font-weight: 800; letter-spacing: -.02em; }
.lp-title em { font-style: normal; background: linear-gradient(135deg, #ff8a2a, #ffb347 55%, #c4b5fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lp-sub { margin: 18px auto 0; max-width: 620px; font-size: clamp(15px, 1.8vw, 18px); line-height: 1.6; color: rgba(255,255,255,.78); }

.lp-ask { margin: 30px auto 0; max-width: 620px; display: flex; gap: 8px; padding: 8px; border-radius: 18px; background: var(--lp-glass); border: 1px solid rgba(255,255,255,.18); box-shadow: var(--lp-glass-shadow); backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); }
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

.lp-ideas { margin: 16px auto 0; max-width: 720px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.lp-idea { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 700; color: #fff; background: rgba(60,32,96,.5); border: 1px solid rgba(255,255,255,.22); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.lp-idea svg { color: var(--lp-accent); }
.lp-idea:hover { border-color: var(--lp-accent); }
.lp-idea:focus-visible { outline: 3px solid var(--lp-accent); outline-offset: 2px; }
.lp-timeline { margin-top: 14px; font-size: 14px; color: rgba(255,255,255,.75); }

/* What's new */
.lp-new { margin-top: 22px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.lp-newItem { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-radius: 16px; color: #fff; text-decoration: none; }
a.lp-newItem:hover { border-color: rgba(255,179,71,.6); }
.lp-newItem svg { color: #ffb347; flex-shrink: 0; margin-top: 2px; }
.lp-newItem b { display: block; font-size: 14.5px; }
.lp-newItem span { display: block; margin-top: 3px; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,.72); }
.lp-newTag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #1a0e06; background: #6ee7a8; vertical-align: 2px; }

/* Section heads */
.lp-section { padding: clamp(40px, 6vw, 72px) 0; }
.lp-label { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #ffb347; text-shadow: 0 1px 8px rgba(0,0,0,.5); }
.lp-h2, .lp-title, .lp-sub { text-shadow: 0 2px 18px rgba(0,0,0,.45); }
.lp-title em { text-shadow: none; filter: drop-shadow(0 2px 10px rgba(0,0,0,.35)); }
.lp-h2 { margin: 10px 0 0; font-family: "Playfair Display", "Syne", Georgia, serif; font-size: clamp(26px, 3.6vw, 40px); line-height: 1.12; font-weight: 800; }
.lp-lead { margin: 12px 0 0; max-width: 620px; font-size: 15.5px; line-height: 1.6; color: rgba(255,255,255,.72); }

/* Three ways to plan */
.lp-paths { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.lp-path { position: relative; display: flex; flex-direction: column; gap: 12px; text-align: left; padding: 24px; border-radius: 20px; cursor: pointer; font: inherit; color: #fff; transition: transform .18s, border-color .18s, box-shadow .18s; }
.lp-path:hover { transform: translateY(-3px); border-color: rgba(255,138,42,.6); box-shadow: var(--lp-glass-shadow), 0 0 0 1px rgba(255,138,42,.25), 0 14px 40px rgba(255,138,42,.18); }
.lp-path__icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ffb347; background: rgba(255,138,42,.14); border: 1px solid rgba(255,138,42,.3); }
.lp-path--atlas .lp-path__icon { color: #c4b5fd; background: rgba(124,92,252,.16); border-color: rgba(124,92,252,.4); }
.lp-path__title { font-size: 19px; font-weight: 800; }
.lp-path__text { font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.72); flex: 1; }
.lp-path__go { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; color: #ffb347; }
.lp-path--atlas .lp-path__go { color: #c4b5fd; }

/* Sync Together band */
.lp-sync { margin-top: 8px; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 28px; align-items: center; padding: clamp(24px, 4vw, 44px); border-radius: 26px; background: linear-gradient(135deg, rgba(255,138,42,.28), rgba(124,92,252,.30)), var(--lp-glass); border: 1px solid rgba(255,179,71,.4); box-shadow: var(--lp-glass-shadow); backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); }
.lp-sync__badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.lp-sync__list { margin: 18px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.lp-sync__list li { display: flex; gap: 10px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,.85); }
.lp-sync__list svg { color: #ffb347; flex-shrink: 0; margin-top: 3px; }
.lp-sync__card { padding: 20px; border-radius: 18px; background: rgba(24,12,44,.55); border: 1px solid rgba(255,255,255,.16); }
.lp-sync__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,.08); font-size: 14px; }
.lp-sync__row:first-of-type { border-top: 0; }
.lp-sync__who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lp-sync__dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #1a0e06; flex-shrink: 0; }
.lp-sync__paid { font-size: 12px; font-weight: 800; color: #6ee7a8; }
.lp-sync__due { font-size: 12px; font-weight: 800; color: #ffc27a; }

/* Feature grid */
.lp-feats { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.lp-feat { padding: 22px; border-radius: 18px; }
.lp-feat svg { color: #ffb347; }
.lp-feat h3 { margin: 12px 0 6px; font-size: 17px; font-weight: 800; }
.lp-feat p { margin: 0; font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.7); }
.lp-feat a { display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 14px; font-weight: 800; color: #ffb347; text-decoration: none; }
.lp-feat a:hover { color: #fff; }

/* Steps */
.lp-steps { margin-top: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; counter-reset: step; }
.lp-step { padding: 22px; border-radius: 18px; }
.lp-step__n { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.lp-step h3 { margin: 12px 0 6px; font-size: 16.5px; font-weight: 800; }
.lp-step p { margin: 0; font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.78); }

/* Final call to action */
.lp-cta { margin: 8px 0 clamp(48px, 7vw, 88px); text-align: center; padding: clamp(28px, 5vw, 52px) 24px; border-radius: 26px; }
.lp-cta__btns { margin-top: 22px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border-radius: 999px; font: inherit; font-weight: 800; font-size: 15px; text-decoration: none; cursor: pointer; border: 1px solid transparent; }
/* Main buttons: Skyrio purple. Colors are pinned for every link state,
   because the site's global link styles turned the text blue on hover. */
.lp a.lp-btn--primary, .lp a.lp-btn--primary:link, .lp a.lp-btn--primary:visited,
.lp a.lp-btn--primary:hover, .lp a.lp-btn--primary:active, .lp a.lp-btn--primary:focus {
  color: #fff !important; text-decoration: none !important;
  background: linear-gradient(135deg, #7c5cfc 0%, #9b6bff 55%, #c084fc 100%);
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 10px 28px rgba(124,92,252,.45), inset 0 1px 0 rgba(255,255,255,.25);
  transition: transform .15s, box-shadow .15s, filter .15s;
}
.lp a.lp-btn--primary svg { color: #fff !important; }
.lp a.lp-btn--primary:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 14px 34px rgba(124,92,252,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.lp a.lp-btn--ghost, .lp a.lp-btn--ghost:link, .lp a.lp-btn--ghost:visited {
  color: #fff !important; text-decoration: none !important;
  background: rgba(60,32,96,.35); border-color: rgba(255,255,255,.3);
}
.lp a.lp-btn--ghost svg { color: inherit !important; }
.lp a.lp-btn--ghost:hover, .lp a.lp-btn--ghost:focus { color: #ffb347 !important; border-color: #ffb347; }
/* Orange partner button (Find a hotel): pairs with the purple one, the
   same orange + purple as the navbar. */
.lp a.lp-btn--orange, .lp a.lp-btn--orange:link, .lp a.lp-btn--orange:visited,
.lp a.lp-btn--orange:hover, .lp a.lp-btn--orange:active, .lp a.lp-btn--orange:focus {
  color: #1a0e06 !important; text-decoration: none !important;
  background: linear-gradient(135deg, #ff8a2a, #ffb347);
  border-color: rgba(255,255,255,.2);
  box-shadow: 0 10px 28px rgba(255,138,42,.4), inset 0 1px 0 rgba(255,255,255,.35);
  transition: transform .15s, box-shadow .15s, filter .15s;
}
.lp a.lp-btn--orange svg { color: #1a0e06 !important; }
.lp a.lp-btn--orange:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 14px 34px rgba(255,138,42,.55), inset 0 1px 0 rgba(255,255,255,.4); }
@media (prefers-reduced-motion: reduce) { .lp a.lp-btn--primary:hover, .lp a.lp-btn--orange:hover { transform: none; } }

@media (max-width: 1100px) {
  .lp-orb { opacity: .45; }
}
@media (max-width: 1000px) {
  .lp-new { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .lp-paths, .lp-feats, .lp-steps { grid-template-columns: 1fr; }
  .lp-sync { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .lp-new { grid-template-columns: 1fr; }
  .lp-orb { opacity: .55; }
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
  .lp, .lp-stars { transition: none; }
  .lp-path { transition: none; }
  .lp-path:hover { transform: none; }
}
`;

const PATHS = [
  {
    key: "search",
    Icon: Search,
    title: "Search myself",
    text: "Compare flights and hotels.",
    go: "Search",
  },
  {
    key: "budget",
    Icon: Wallet,
    title: "Plan on a budget",
    text: "Set a budget. See what fits.",
    go: "Set budget",
  },
  {
    key: "atlas",
    Icon: Sparkles,
    title: "Let Atlas plan it",
    text: "Say it in your words. Atlas does the rest.",
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
  const time = useTimeOfDay();
  const T = TIMES[time];
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
    <div className={`lp lp--${time}`} data-time={time}>
      <style>{CSS}</style>
      <div className="lp-stars" aria-hidden="true" />
      <div className="lp-orb" aria-hidden="true" />

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <span className="lp-kicker">
            <T.Icon size={14} aria-hidden="true" />
            {T.hello}
            {isAuthed && firstName ? `, ${firstName}` : ""}
          </span>
          <h1 className="lp-title">
            Plan smarter. <em>Travel better.</em>
          </h1>
          <p className="lp-sub">
            Flights, hotels and group trips. All in one place.
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
          <div className="lp-ideas" aria-label="Ideas to ask Atlas">
            {T.ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                className="lp-idea"
                onClick={() => openAtlas(idea)}
              >
                <Sparkles size={13} aria-hidden="true" /> {idea}
              </button>
            ))}
          </div>
          <div className="lp-timeline">{T.line}</div>
          <div className="lp-hint">
            <Link to="/booking" style={{ color: "#ffb347", fontWeight: 700 }}>
              Or search yourself →
            </Link>
          </div>

          <div className="lp-trust">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Secure checkout
            </span>
            <span>
              <CalendarX2 size={15} aria-hidden="true" /> Refund estimate before
              you cancel
            </span>
            <span>
              <Users size={15} aria-hidden="true" /> No account needed
            </span>
          </div>

          <div className="lp-new" aria-label="New on Skyrio">
            {NEW_THINGS.map(({ Icon, title, text, to }) => {
              const body = (
                <>
                  <Icon size={20} aria-hidden="true" />
                  <div style={{ textAlign: "left" }}>
                    <b>
                      {title}
                      <em className="lp-newTag" style={{ fontStyle: "normal" }}>
                        New
                      </em>
                    </b>
                    <span>{text}</span>
                  </div>
                </>
              );
              return to ? (
                <Link key={title} to={to} className="lp-newItem">
                  {body}
                </Link>
              ) : (
                <div key={title} className="lp-newItem">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Three ways to plan ── */}
      <section className="lp-section" aria-labelledby="lp-paths-title">
        <div className="lp-wrap">
          <div className="lp-label">Start here</div>
          <h2 className="lp-h2" id="lp-paths-title">
            Three ways to plan.
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
                Plan with friends. Pay your own share.
              </h2>
              <ul className="lp-sync__list">
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Invite with one link.
                </li>
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Pick flights and a stay together.
                </li>
                <li>
                  <ArrowRight size={16} aria-hidden="true" />
                  Everyone pays their part. No chasing money.
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
            More than booking.
          </h2>
          <div className="lp-feats">
            <div className="lp-feat">
              <Award size={24} aria-hidden="true" />
              <h3>Digital Passport &amp; XP</h3>
              <p>Earn XP and stamps every trip.</p>
              <Link to="/passport">
                {isAuthed ? "Open my Passport" : "See the Passport"}{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="lp-feat">
              <Globe2 size={24} aria-hidden="true" />
              <h3>SkyHub</h3>
              <p>Real tips from real travelers.</p>
              <Link to="/skyhub">
                Explore SkyHub <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="lp-feat">
              <CalendarX2 size={24} aria-hidden="true" />
              <h3>Change of plans? Easy.</h3>
              <p>Cancel in a few taps. See your refund first.</p>
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
            Book in 3 steps.
          </h2>
          <div className="lp-steps">
            <div className="lp-step">
              <span className="lp-step__n">1</span>
              <h3>Find it</h3>
              <p>Search, set a budget or ask Atlas. Prices cover everyone.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step__n">2</span>
              <h3>Book it</h3>
              <p>Add travelers, pick seats, pay. Confirmation by email.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step__n">3</span>
              <h3>Manage it</h3>
              <p>View or cancel anytime. Check in with the airline.</p>
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
              ? "Book it yourself or ask Atlas."
              : "Book as a guest, or join free to earn XP."}
          </p>
          <div className="lp-cta__btns">
            <Link to="/booking" className="lp-btn lp-btn--primary">
              <Plane size={16} aria-hidden="true" /> Book a flight
            </Link>
            <Link to="/booking" className="lp-btn lp-btn--orange">
              <BedDouble size={16} aria-hidden="true" /> Find a hotel
            </Link>
            {!isAuthed && (
              <Link to="/register" className="lp-btn lp-btn--ghost">
                <Send size={16} aria-hidden="true" /> Join free
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
