// Atlas cards for group trips.
//
// • type "group_trip": a Sync Together trip Atlas just made from its plan,
//   with its top flights and hotels on the shortlist to vote on.
// • type "group_signup_hint": a small, optional note for guests planning
//   for a group. Shown once per visit, easy to dismiss, never blocks booking.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Link2, Check, X } from "lucide-react";
import "@/styles/atlas-checkout.css";

const HINT_KEY = "skyrio_group_hint"; // "shown" | "dismissed"

const SECONDARY = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 14,
  color: "#f5f1ff",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.18)",
  cursor: "pointer",
  fontFamily: "inherit",
};

// Lets only the first group hint of a visit through (the panel calls this
// when an answer arrives), so it never repeats.
export function keepFirstGroupHint(actions) {
  let seen = "";
  try {
    seen = sessionStorage.getItem(HINT_KEY) || "";
  } catch {
    /* storage blocked: show it, it's still dismissible */
  }
  return actions.filter((a) => {
    if (a?.type !== "group_signup_hint") return true;
    if (seen) return false;
    seen = "shown";
    try {
      sessionStorage.setItem(HINT_KEY, "shown");
    } catch {
      /* fine */
    }
    return true;
  });
}

function GroupTripCard({ action }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const counts = [
    action.flights ? `${action.flights} flight${action.flights === 1 ? "" : "s"}` : null,
    action.hotels ? `${action.hotels} hotel${action.hotels === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const share = async () => {
    const text = `Help pick our ${action.title} on Skyrio. Vote here:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: action.title, text, url: action.inviteUrl });
        return;
      }
      await navigator.clipboard.writeText(action.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* closed the share sheet */
    }
  };

  return (
    <div className="atlas-checkout-card">
      <div className="atlas-checkout-card__head">
        <span className="atlas-checkout-card__icon">
          <Users size={17} aria-hidden="true" />
        </span>
        <div>
          <div className="atlas-checkout-card__title">{action.title}</div>
          <div className="atlas-checkout-card__sub">
            Group trip ready{counts ? `: ${counts} to vote on` : ""}
          </div>
        </div>
      </div>
      <a
        className="atlas-checkout-card__cta"
        href={action.url}
        onClick={(e) => {
          e.preventDefault();
          try {
            navigate(new URL(action.url).pathname);
          } catch {
            window.location.href = action.url;
          }
        }}
      >
        Open group trip
      </a>
      <button type="button" style={SECONDARY} onClick={share}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
        {copied ? "Invite link copied" : "Invite friends"}
      </button>
      <div className="atlas-checkout-card__note">
        Friends join with the link, vote, then each books and pays their own part.
      </div>
    </div>
  );
}

function GroupSignupHint() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HINT_KEY) === "dismissed";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HINT_KEY, "dismissed");
    } catch {
      /* fine */
    }
  };
  return (
    <div
      className="atlas-checkout-card"
      style={{ borderColor: "rgba(155,92,255,0.35)", gap: 8 }}
      role="note"
    >
      <div className="atlas-checkout-card__head">
        <span
          className="atlas-checkout-card__icon"
          style={{ background: "linear-gradient(135deg, #9b5cff, #ff8a3d)", color: "#fff" }}
        >
          <Users size={16} aria-hidden="true" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="atlas-checkout-card__title" style={{ fontSize: 14 }}>
            Planning with friends?
          </div>
          <div className="atlas-checkout-card__sub">
            A free account lets your group vote and each pay their own part. Totally
            optional.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks"
          style={{
            background: "none",
            border: "none",
            color: "rgba(245,241,255,0.55)",
            cursor: "pointer",
            padding: 4,
            alignSelf: "flex-start",
          }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          style={{ ...SECONDARY, flex: 1, borderColor: "rgba(255,159,67,0.45)" }}
          onClick={() => navigate("/register")}
        >
          Sign up free
        </button>
        <button type="button" style={{ ...SECONDARY, flex: 1 }} onClick={dismiss}>
          No thanks
        </button>
      </div>
    </div>
  );
}

export default function AtlasGroupCard({ action }) {
  if (action?.type === "group_trip") return <GroupTripCard action={action} />;
  if (action?.type === "group_signup_hint") return <GroupSignupHint />;
  return null;
}
