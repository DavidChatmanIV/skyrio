// Rank = lifetime XP (totalEarned). Balance = spendable XP (xp).
import { useState } from "react";
import {
  XP_TIERS,
  getTier,
  getNextTier,
  getTierProgress,
} from "@/config/xpConfig";
import TierIcon from "@/components/passport/TierIcon";
import "@/styles/passport-share.css";

const fmt = (n) => Number(n || 0).toLocaleString();

export function XpWalletCard({ totalEarned = 0, xp = 0 }) {
  const tier = getTier(totalEarned);
  const next = getNextTier(totalEarned);
  const progress = getTierProgress(totalEarned); // 0–100
  return (
    <div className="xpw">
      <div className="xpw-col">
        <span className="xpw-label">Your rank</span>
        <strong
          className="xpw-big"
          style={{
            color: tier.color,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TierIcon tier={tier} size={24} /> {tier.name}
        </strong>
        <span className="xpw-sub">{fmt(totalEarned)} XP earned all-time</span>
        {next ? (
          <>
            <div className="xpw-bar">
              <i style={{ width: `${progress}%`, background: tier.color }} />
            </div>
            <span className="xpw-sub">
              {fmt(next.min - totalEarned)} XP to {next.name}
            </span>
          </>
        ) : (
          <span className="xpw-sub">Top rank reached 👑</span>
        )}
      </div>
      <div className="xpw-divider" />
      <div className="xpw-col">
        <span className="xpw-label">Spendable balance</span>
        <strong className="xpw-big">{fmt(xp)} XP</strong>
        <span className="xpw-sub">Spend on boosts, badges, perks & drops</span>
      </div>
    </div>
  );
}

export default function HowXpWorks({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="hxw">
      <button
        className="hxw-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        How XP & rewards work <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="hxw-body">
          <div className="hxw-grid">
            <div>
              <h4>1 · Earn</h4>
              <p>
                Booking trips earns the most XP. You also earn from verified
                reviews, Challenges, friends you invite who book, and SkyHub
                activity. Booking XP shows as pending until the
                free-cancellation window passes.
              </p>
            </div>
            <div>
              <h4>2 · Rank up</h4>
              <p>
                Every XP you earn counts toward your rank. Spending XP on
                rewards never lowers your rank. Only cancelled bookings or
                removed posts take their XP back.
              </p>
            </div>
            <div>
              <h4>3 · Spend</h4>
              <p>
                Your spendable balance is separate from your rank. Redeeming a
                reward lowers your balance only, so you can treat yourself
                without losing status.
              </p>
            </div>
          </div>
          <h4 className="hxw-ranks-title">Ranks</h4>
          <ol className="hxw-ranks">
            {XP_TIERS.map((t) => (
              <li key={t.name}>
                <TierIcon tier={t} size={14} />
                {t.name}
                <em>{fmt(t.min)}+ XP</em>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// Body for your "Confirm redemption" dialog.
export function RedeemConfirmBody({ reward, xp = 0, totalEarned = 0 }) {
  const tier = getTier(totalEarned);
  const after = Math.max(0, xp - reward.cost);
  return (
    <>
      <p>
        Redeem <strong>{reward.title}</strong> for{" "}
        <strong>{fmt(reward.cost)} XP</strong>?
      </p>
      <ul className="redeem-math">
        <li>
          <span>Spendable balance</span>
          <b>
            {fmt(xp)} → {fmt(after)} XP
          </b>
        </li>
        <li>
          <span>Your rank</span>
          <b style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <TierIcon tier={tier} size={14} /> {tier.name} (unchanged)
          </b>
        </li>
      </ul>
    </>
  );
}
