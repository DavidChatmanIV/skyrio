import React from "react";
import { Progress, Skeleton } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { Camera, Loader2 } from "lucide-react";
import FollowStats from "./FollowStats";
import PlaneBadge, { PlaneBadgePending } from "./PlaneBadge";
import "../../styles/passport-datapage.css";

/* ─────────────────────────────────────────────────────────────
   MRZ helpers — real ICAO 9303 check-digit math, so the strip
   at the bottom reads like a genuine machine-readable zone.
   ───────────────────────────────────────────────────────────── */
const MRZ_LEN = 44;

const mrzText = (s) =>
  String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "<");

const mrzPad = (s, len = MRZ_LEN) => (s + "<".repeat(len)).slice(0, len);

function mrzCheck(s) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v = 0;
    if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55;
    sum += v * weights[i % 3];
  }
  return String(sum % 10);
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function yymmdd(d) {
  if (!d) return "<<<<<<";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function formatIssued(d) {
  if (!d) return "—";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function buildMrz({ name, tier, docNo, issued, homeBase }) {
  const line1 = mrzPad(`P<SKY${mrzText(name)}<<${mrzText(tier)}`);
  const doc = mrzPad(docNo, 9);
  const iss = yymmdd(issued);
  const optional = mrzPad(mrzText(homeBase), 14);
  const body = `${doc}${mrzCheck(doc)}SKY${iss}${mrzCheck(
    iss
  )}<<<<<<<<${optional}`;
  const composite = mrzCheck(body.replace(/SKY/, ""));
  const line2 = mrzPad(body, MRZ_LEN - 1) + composite;
  return [line1, line2];
}

/* ─────────────────────────────────────────────────────────────
   Guilloche security pattern — generated once at module load.
   ───────────────────────────────────────────────────────────── */
const GUILLOCHE = (() => {
  const W = 800;
  const H = 360;
  const waves = [];
  for (let k = 0; k < 14; k++) {
    let d = "";
    for (let x = 0; x <= W; x += 8) {
      const y =
        H * 0.55 +
        Math.sin(x / 62 + k * 0.45) * (60 + k * 4) +
        Math.sin(x / 23 + k) * 9;
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)} `;
    }
    waves.push(d);
  }
  const rosette = [];
  const cx = 660;
  const cy = 120;
  for (let k = 0; k < 10; k++) {
    let d = "";
    for (let t = 0; t <= 360; t += 3) {
      const a = (t * Math.PI) / 180;
      const r = 62 + k * 4 + 14 * Math.sin(12 * a + k * 0.6);
      d += `${t === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(1)} ${(
        cy +
        r * Math.sin(a)
      ).toFixed(1)} `;
    }
    rosette.push(`${d}Z`);
  }
  return { W, H, waves, rosette };
})();

/* ─────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────── */
export default function PassportDataPage({
  user,
  myId,
  displayName,
  handle,
  currentBadge,
  homeBaseLabel,
  // social
  passportStats,
  statsLoading,
  onClickFollowers,
  onClickFollowing,
  referralsCount = 0,
  // avatar
  avatarInputRef,
  avatarUploading,
  onAvatarChange,
  // xp
  xpLoading,
  xpPercent,
  totalEarned,
  xp,
  nextBadgeName,
  badgePercent,
  xpIntoLevel,
  xpNeeded,
  onSpendXp,
}) {
  const hasAvatar = !!user?.avatar && user.avatar !== "/default-avatar.png";
  const issued = toDate(user?.createdAt);
  const docNo =
    mrzText(String(myId || ""))
      .replace(/</g, "")
      .slice(-9)
      .padStart(9, "0") || "000000000";
  const homeBaseSet = homeBaseLabel && homeBaseLabel !== "Not set";
  const [mrz1, mrz2] = buildMrz({
    name: displayName,
    tier: currentBadge,
    docNo,
    issued,
    homeBase: homeBaseSet ? homeBaseLabel : "",
  });

  const openPicker = () => {
    if (!avatarUploading) avatarInputRef?.current?.click();
  };

  return (
    <section className="pdp" aria-label="Digital passport">
      {/* Security pattern */}
      <svg
        className="pdp-guilloche"
        viewBox={`0 0 ${GUILLOCHE.W} ${GUILLOCHE.H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {GUILLOCHE.waves.map((d, i) => (
          <path key={`w${i}`} d={d} />
        ))}
        {GUILLOCHE.rosette.map((d, i) => (
          <path key={`r${i}`} d={d} className="pdp-rosette" />
        ))}
      </svg>

      {/* Header strip */}
      <header className="pdp-head">
        <div className="pdp-headBrand">
          <span className="pdp-emblem" aria-hidden="true">
            ✈
          </span>
          SKYRIO
        </div>
        <div className="pdp-headTitle">
          Digital Passport
          <span className="pdp-headAlt"> · Passeport · Pasaporte</span>
        </div>
        <div className="pdp-headType">Type P · Code SKY</div>
      </header>

      <div className="pdp-body">
        {/* ── Photo column ── */}
        <div className="pdp-photoCol">
          <input
            type="file"
            accept="image/*"
            hidden
            ref={avatarInputRef}
            onChange={onAvatarChange}
          />
          <button
            type="button"
            className="pdp-photo"
            onClick={openPicker}
            disabled={avatarUploading}
            aria-label="Change passport photo"
          >
            {hasAvatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <UserOutlined className="pdp-photoFallback" />
            )}
            <span className="pdp-holo" aria-hidden="true" />
            <span className="pdp-photoCam" aria-hidden="true">
              {avatarUploading ? (
                <Loader2 size={13} className="pdp-spin" />
              ) : (
                <Camera size={13} />
              )}
            </span>
          </button>

          <div className="pdp-sigWrap">
            <div className="pdp-label">Holder's signature</div>
            <div className="pdp-sig">{displayName}</div>
          </div>

          {hasAvatar && (
            <img
              className="pdp-ghost"
              src={user.avatar}
              alt=""
              aria-hidden="true"
            />
          )}
        </div>

        {/* ── Data fields ── */}
        <div className="pdp-fields">
          <div className="pdp-label">Holder / Titulaire</div>
          <h2 className="pdp-name">{displayName}</h2>
          <div className="pdp-handle">
            {handle}
            {user?.verifiedTier ? (
              <PlaneBadge tier={user.verifiedTier} size={15} />
            ) : user?.verificationPending ? (
              <PlaneBadgePending size={14} />
            ) : null}
          </div>
          {user?.bio && <p className="pdp-bio">“{user.bio}”</p>}

          <dl className="pdp-grid">
            <div>
              <dt className="pdp-label">Passport No.</dt>
              <dd className="pdp-value pdp-mono">{docNo}</dd>
            </div>
            <div>
              <dt className="pdp-label">Tier</dt>
              <dd className="pdp-value">{currentBadge}</dd>
            </div>
            <div>
              <dt className="pdp-label">Home Base</dt>
              <dd className={`pdp-value${homeBaseSet ? "" : " is-empty"}`}>
                {homeBaseLabel}
              </dd>
            </div>
            <div>
              <dt className="pdp-label">Date of Issue</dt>
              <dd className="pdp-value">{formatIssued(issued)}</dd>
            </div>
            <div>
              <dt className="pdp-label">Valid Until</dt>
              <dd className="pdp-value">Never</dd>
            </div>
            <div>
              <dt className="pdp-label">Status</dt>
              <dd className="pdp-value pdp-status">
                <span className="pdp-statusDot" aria-hidden="true" />
                Active
              </dd>
            </div>
          </dl>

          {user?.travelVibes?.length > 0 && (
            <div className="pdp-endorse">
              <div className="pdp-label">Endorsements</div>
              <div className="pdp-chips">
                {user.travelVibes.map((v) => (
                  <span key={v} className="pdp-chip">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pdp-social">
            <FollowStats
              followers={passportStats.followers}
              following={passportStats.following}
              loading={statsLoading}
              onClickFollowers={onClickFollowers}
              onClickFollowing={onClickFollowing}
            />
            {referralsCount > 0 && (
              <div className="pdp-referrals">
                ✈️ <strong>{referralsCount}</strong>{" "}
                {referralsCount === 1 ? "traveler" : "travelers"} joined via
                your passport
              </div>
            )}
          </div>
        </div>

        {/* ── Rank column ── */}
        <div className="pdp-ringCol">
          {xpLoading ? (
            <div style={{ width: 180 }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ) : (
            <>
              <Progress
                type="dashboard"
                percent={xpPercent}
                size={168}
                strokeWidth={9}
                strokeColor={{ "0%": "#ff9d4a", "100%": "#8b5cff" }}
                trailColor="rgba(255,255,255,0.08)"
                format={() => (
                  <div className="pdp-ringText">
                    <span className="pdp-ringTier">{currentBadge}</span>
                    <span className="pdp-ringXp">
                      {Number(totalEarned).toLocaleString()}
                    </span>
                    <span className="pdp-ringUnit">lifetime XP</span>
                  </div>
                )}
              />
              {nextBadgeName && (
                <div className="pdp-next">
                  <div className="pdp-nextBar">
                    <div
                      className="pdp-nextFill"
                      style={{ width: `${badgePercent}%` }}
                    />
                  </div>
                  <div className="pdp-nextLabel">
                    {Number(xpIntoLevel).toLocaleString()} /{" "}
                    {Number(xpNeeded).toLocaleString()} XP to{" "}
                    <strong>{nextBadgeName}</strong>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="pdp-spend"
                onClick={onSpendXp}
                title="Your rank never drops when you redeem rewards"
              >
                {Number(xp).toLocaleString()} XP to spend →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Machine-readable zone (decorative) */}
      <div className="pdp-mrz" aria-hidden="true">
        <div>{mrz1}</div>
        <div>{mrz2}</div>
      </div>
    </section>
  );
}
