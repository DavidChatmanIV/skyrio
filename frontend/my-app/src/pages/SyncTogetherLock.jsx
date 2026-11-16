/**
 * SyncTogetherLock.jsx
 * Shown on /sync-together when logged out. Same purple glass as the rest
 * of Skyrio: short, plain, one button.
 */
import { useNavigate } from "react-router-dom";

const svg = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const GroupIcon = () => (
  <svg {...svg} width={30} height={30}>
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
  </svg>
);
const LinkIcon = () => (
  <svg {...svg}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const VoteIcon = () => (
  <svg {...svg}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const ChatIcon = () => (
  <svg {...svg}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const PlaneIcon = () => (
  <svg {...svg}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);

const STEPS = [
  { Icon: LinkIcon, text: "Invite your crew with a link" },
  { Icon: VoteIcon, text: "Vote on the plan together" },
  { Icon: ChatIcon, text: "Chat in one place" },
  { Icon: PlaneIcon, text: "Everyone books their own flight and room" },
];

const CSS = `
.stl { display: flex; justify-content: center; padding: 32px 16px 48px; color: #fff;
  font-family: "DM Sans", system-ui, sans-serif; box-sizing: border-box; }
.stl__card { position: relative; width: 100%; max-width: 480px; text-align: center;
  padding: 36px 22px 26px; border-radius: 26px; overflow: hidden;
  background: linear-gradient(160deg, rgba(74,40,112,.58) 0%, rgba(34,18,62,.66) 100%);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 18px 44px rgba(12,4,28,.38);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.stl__card::before { content: ""; position: absolute; top: 0; left: 24px; right: 24px; height: 3px;
  border-radius: 0 0 3px 3px; background: linear-gradient(90deg, #ff8a2a, #ffb347 50%, #8b5cf6); }
.stl__icon { width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 20px; display: grid;
  place-items: center; color: #fff; background: linear-gradient(135deg, #ff8a2a, #8b5cf6);
  box-shadow: 0 10px 26px rgba(139,92,246,.35); }
.stl__title { margin: 0 0 8px; font-size: clamp(24px, 6vw, 30px); font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.15; }
.stl__lead { margin: 0 auto 22px; max-width: 340px; font-size: 15px; line-height: 1.5;
  color: rgba(255,255,255,.75); }
.stl__list { list-style: none; margin: 0 0 22px; padding: 0; display: grid; gap: 8px; text-align: left; }
.stl__row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08);
  font-size: 15px; font-weight: 600; color: rgba(255,255,255,.9); }
.stl__row svg { color: #ffb347; flex-shrink: 0; }
.stl__btn { width: 100%; min-height: 52px; border: 0; border-radius: 999px; cursor: pointer;
  font: inherit; font-size: 16px; font-weight: 800; color: #1a0e06;
  background: linear-gradient(135deg, #ff8a2a, #ffb347);
  box-shadow: 0 10px 28px rgba(255,138,42,.4), inset 0 1px 0 rgba(255,255,255,.35);
  transition: transform .15s, filter .15s; }
.stl__btn:active { transform: scale(.98); }
@media (hover: hover) { .stl__btn:hover { transform: translateY(-1px); filter: brightness(1.06); } }
.stl__btn:focus-visible, .stl__link:focus-visible { outline: 3px solid #ffb347; outline-offset: 3px; }
.stl__login { margin-top: 14px; font-size: 14px; color: rgba(255,255,255,.7); }
.stl__link { background: none; border: 0; padding: 0; font: inherit; font-weight: 800;
  color: #ffb347; cursor: pointer; }
`;

export default function SyncTogetherLock() {
  const navigate = useNavigate();
  const back = { state: { redirectTo: "/sync-together" } };

  return (
    <div className="stl">
      <style>{CSS}</style>
      <div className="stl__card">
        <div className="stl__icon">
          <GroupIcon />
        </div>
        <h1 className="stl__title">Plan a group trip</h1>
        <p className="stl__lead">
          Make a free account to start a trip with friends or family.
        </p>
        <ul className="stl__list">
          {STEPS.map(({ Icon, text }) => (
            <li key={text} className="stl__row">
              <Icon />
              {text}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="stl__btn"
          onClick={() => navigate("/register", back)}
        >
          Join free
        </button>
        <div className="stl__login">
          Have an account?{" "}
          <button
            type="button"
            className="stl__link"
            onClick={() => navigate("/login", back)}
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
