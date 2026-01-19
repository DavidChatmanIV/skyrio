import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Avatar,
  Button,
  Progress,
  Input,
  Tag,
  Segmented,
  message as antdMessage,
  Skeleton,
} from "antd";
import {
  UserOutlined,
  CopyOutlined,
  ShareAltOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  IdcardOutlined,
  CompassOutlined,
  GlobalOutlined,
  GiftOutlined,
  RightOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { io } from "socket.io-client";

/* ✅ IMPORTANT: load Passport CSS on this route */
import "../../styles/profile-passport.css";

/* world map  */
import passportBg from "../../assets/DigitalPassport/worldmap.png";

import ProfileMusicModal, {
  SKYRIO_PROFILE_MUSIC_KEY,
} from "./music/ProfileMusicModal";

import PassportFooter from "./PassportFooter";
import PassportHighlights from "./PassportHighlights";
import StampStrip from "./StampStrip";
import TravelHistory from "./TravelHistory";
import TripList from "./TripList";
import VisaList from "./VisaList";
import SkyrioExchange from "./SkyrioExchange";

/* Followers/Following Modal */
import FollowersModal from "./FollowersModal";

/* Top 8 (Places only here) */
import TopEight from "./TopEight";
import TopEightItemPlace from "./TopEightItemPlace";

/* ✅ Privileges */
import PassportPrivilegesCard from "./PassportPrivilegesCard";

/* ✅ Exchange preview card (for Summary) */
import SkyrioExchangePreviewCard from "./SkyrioExchangePreviewCard";

/* ✅ Use ONE auth hook consistently across the app (match Navbar usage) */
import { useAuth } from "../../auth/useAuth";

/* Rewards opt-in prompt */
import RewardsOptInPrompt from "../../components/rewards/RewardsOptInPrompt";
import useRewardsOptInPrompt from "../../hooks/useRewardsOptInPrompt";

/* ✅ Admin controls (admin-only panels inside Passport, NOT a gate) */
import AdminQuickControls from "./AdminQuickControls";

const { Title, Text } = Typography;

function safeEmailPrefix(email) {
  if (!email) return "";
  const idx = email.indexOf("@");
  return idx > 0 ? email.slice(0, idx) : email;
}

function makeReferralCode(user) {
  const base =
    user?.username || user?.name || safeEmailPrefix(user?.email) || "EXPLORER";
  return `SKYRIO-${String(base)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")}-001`;
}

/* ✅ Tabs */
const PASSPORT_TABS = [
  { key: "summary", label: "Passport Summary", icon: <IdcardOutlined /> },
  { key: "journeys", label: "Your Journeys", icon: <CompassOutlined /> },
  { key: "borders", label: "Access & Borders", icon: <GlobalOutlined /> },
  { key: "vault", label: "Rewards Vault", icon: <GiftOutlined /> },
];

export default function DigitalPassportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const rewardsOptIn = useRewardsOptInPrompt();

  const isAdmin = auth?.user?.role === "admin";
  const isAuthed = !!auth?.user;

  const [musicOpen, setMusicOpen] = useState(false);
  const [profileMusic, setProfileMusic] = useState(null);

  const [segment, setSegment] = useState("summary");

  // Loading states (better UX for 18–40: no “blank” UI)
  const [xpLoading, setXpLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [xp, setXp] = useState(0);
  const [xpToNextBadge, setXpToNextBadge] = useState(0);
  const [nextBadgeName, setNextBadgeName] = useState("Wanderer");

  const [passportStats, setPassportStats] = useState({
    followers: 0,
    following: 0,
  });

  const [followOpen, setFollowOpen] = useState(false);
  const [followMode, setFollowMode] = useState("following");

  const socketRef = useRef(null);

  const rewardsEnabled = !!auth?.user?.settings?.rewardsEnabled;

  const displayName = useMemo(() => {
    const u = auth?.user;
    if (!u) return "Explorer";
    return (
      u.username || u.name || (u.email ? safeEmailPrefix(u.email) : "Explorer")
    );
  }, [auth?.user]);

  const handle = useMemo(() => {
    const u = auth?.user;
    if (!u) return "@explorer";
    const base = u.username || safeEmailPrefix(u.email) || "explorer";
    return `@${String(base).toLowerCase()}`;
  }, [auth?.user]);

  const levelNumber = useMemo(
    () => Number(auth?.user?.level ?? 1),
    [auth?.user]
  );

  const passportExpiresLabel = useMemo(() => "Dec 31, 2026", []);
  const passportIssuedLabel = useMemo(() => "Jan 1, 2026", []);

  const referralCode = useMemo(
    () => makeReferralCode(auth?.user),
    [auth?.user]
  );

  const myId = useMemo(() => {
    const u = auth?.user;
    return u?._id || u?.id || null;
  }, [auth?.user]);

  const canEditTop8 = !!auth?.user;

  // ✅ Inner Circle preview (wire real data later)
  const innerCircleFriends = useMemo(
    () => [
      { id: "ic1", name: "Tokyo", coverUrl: "/images/circle/friend1.jpg" },
      { id: "ic2", name: "Paris", coverUrl: "/images/circle/friend2.jpg" },
      { id: "ic3", name: "Dubai", coverUrl: "/images/circle/friend3.jpg" },
    ],
    []
  );

  const top8Places = useMemo(
    () => [
      { id: "p1", name: "Tokyo", country: "Japan", badge: "Dream Trip" },
      { id: "p2", name: "Paris", country: "France", badge: "Favorite" },
      { id: "p3", name: "Dubai", country: "UAE", badge: "Luxury" },
      { id: "p4", name: "Honolulu", country: "USA", badge: "Beach" },
    ],
    []
  );

  /* ✅ transition toast after auth redirect */
  useEffect(() => {
    const fromAuth = !!location?.state?.fromAuth;
    if (!fromAuth) return;

    antdMessage.success({
      content: `Welcome aboard${
        auth?.user?.name ? `, ${auth.user.name}` : ""
      } ✈️`,
      duration: 2,
    });

    try {
      window.history.replaceState({}, document.title);
    } catch {
      // ignore
    }
  }, [location?.state?.fromAuth, auth?.user?.name]);

  /* ---------- profile music ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SKYRIO_PROFILE_MUSIC_KEY);
      if (raw) setProfileMusic(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  /* ---------- profile data ---------- */
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    (async () => {
      setXpLoading(true);
      try {
        const res = await fetch("/api/profile/me", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("profile fetch failed");
        const data = await res.json();

        if (!mounted) return;
        setXp(Number(data?.xp ?? 0));
        setXpToNextBadge(Number(data?.xpToNextBadge ?? 0));
        setNextBadgeName(String(data?.nextBadgeName ?? "Wanderer"));
      } catch {
        if (!mounted) return;
        setXp(0);
        setXpToNextBadge(0);
        setNextBadgeName("Wanderer");
      } finally {
        if (mounted) setXpLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  /* load passport stats (followers/following) */
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch("/api/passport/stats", {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();

        if (!mounted) return;
        if (data?.ok) {
          setPassportStats({
            followers: Number(data?.stats?.followers ?? 0),
            following: Number(data?.stats?.following ?? 0),
          });
        } else {
          setPassportStats({ followers: 0, following: 0 });
        }
      } catch {
        if (!mounted) return;
        setPassportStats({ followers: 0, following: 0 });
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  /* socket live sync for counts */
  useEffect(() => {
    if (!myId) return;

    if (!socketRef.current) {
      socketRef.current = io("/", { transports: ["websocket"] });
    }

    const s = socketRef.current;
    s.emit("auth:join", { userId: myId });

    const handler = (payload) => {
      if (!payload) return;
      setPassportStats((prev) => ({
        ...prev,
        followers:
          typeof payload.followers === "number"
            ? payload.followers
            : prev.followers,
        following:
          typeof payload.following === "number"
            ? payload.following
            : prev.following,
      }));
    };

    s.on("social:counts:update", handler);
    return () => s.off("social:counts:update", handler);
  }, [myId]);

  const xpGoal = useMemo(() => {
    const current = Number(xp || 0);
    const remaining = Number(xpToNextBadge || 0);
    const goal = remaining > 0 ? current + remaining : 100;
    return Math.max(1, goal);
  }, [xp, xpToNextBadge]);

  const xpPercent = useMemo(() => {
    const current = Number(xp || 0);
    return Math.max(0, Math.min(100, Math.round((current / xpGoal) * 100)));
  }, [xp, xpGoal]);

  const copyReferral = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      antdMessage.success("Referral code copied");
    } catch {
      antdMessage.error("Copy failed");
    }
  }, [referralCode]);

  const copyPassportLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      antdMessage.success("Passport link copied");
    } catch {
      antdMessage.error("Copy failed");
    }
  }, []);

  const goMembership = useCallback(() => {
    navigate("/membership");
  }, [navigate]);

  /* ✅ Segmented options built from your existing tab list */
  const segmentedOptions = useMemo(
    () =>
      PASSPORT_TABS.map((t) => ({
        label: (
          <span className="ppSegLabel">
            <span className="ppSegIcon">{t.icon}</span>
            <span className="ppSegText">{t.label}</span>
          </span>
        ),
        value: t.key,
      })),
    []
  );

  // ✅ Identity stamps (replace the 3 empty boxes)
  // Home Base: safe fallback until your IP->county API is wired.
  const homeBaseLabel = useMemo(() => {
    // If you later add auth.user.homeBase, it will display automatically.
    const hb = auth?.user?.homeBase;
    if (hb && typeof hb === "string") return hb;
    // Soft-launch safe default:
    return "Based on your region";
  }, [auth?.user?.homeBase]);

  const travelerTypeLabel = useMemo(() => {
    // Your current UI uses “Explorer” as default identity.
    // You can later map this to tiers.
    return "Explorer";
  }, []);

  const memberSinceLabel = useMemo(() => {
    // Later: derive from auth.user.createdAt
    // For now: match your current passport year
    return "2026";
  }, []);

  const PassportContent = (
    <>
      <RewardsOptInPrompt
        open={rewardsOptIn.open}
        onClose={rewardsOptIn.close}
        onConfirm={rewardsOptIn.confirm}
      />

      <div className="pp-page">
        <div className="pp-shell pp-shell--mock">
          {/* ✅ HOME BUTTON (Back to Discover) */}
          <div className="pp-homeBtnWrap">
            <Button
              type="text"
              icon={<LeftOutlined />}
              className="pp-homeBtn"
              onClick={() => navigate("/")}
            >
              Home
            </Button>
          </div>

          {/* =========================
              HERO PANEL (ONE unified passport block)
          ========================= */}
          <Card bordered={false} className="pp-card pp-heroPanel">
            <div className="pp-heroInner">
              {/* LEFT */}
              <div className="pp-heroCol pp-heroCol--left">
                <div className="pp-heroTop">
                  <div className="pp-avatarGlow">
                    <Avatar size={86} icon={<UserOutlined />} />
                  </div>

                  <div className="pp-heroName">
                    <Title level={2} className="pp-title" style={{ margin: 0 }}>
                      {displayName}
                    </Title>

                    <Text className="pp-muted">
                      {handle} · Level {levelNumber}
                    </Text>

                    <div style={{ marginTop: 10 }}>
                      <span className="pp-pill pp-pill--active">
                        🟠 Passport Active
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pp-heroMeta">
                  <div className="pp-kv">
                    <Text className="pp-kvLabel">Issued ·</Text>
                    <Text className="pp-kvValue">{passportIssuedLabel}</Text>
                  </div>

                  <div className="pp-kv">
                    <Text className="pp-kvLabel">Expires ·</Text>
                    <Text className="pp-kvValue">{passportExpiresLabel}</Text>
                  </div>
                </div>

                {/* Follow pills (match mock row) */}
                <div className="pp-followRow">
                  <button
                    className="ppFollowBtn"
                    onClick={() => {
                      setFollowMode("followers");
                      setFollowOpen(true);
                    }}
                    type="button"
                    disabled={!isAuthed}
                    title={!isAuthed ? "Log in to view followers" : ""}
                  >
                    <strong>
                      {statsLoading ? (
                        <span style={{ opacity: 0.75 }}>—</span>
                      ) : (
                        passportStats.followers
                      )}
                    </strong>
                    <span>Followers</span>
                  </button>

                  <button
                    className="ppFollowBtn"
                    onClick={() => {
                      setFollowMode("following");
                      setFollowOpen(true);
                    }}
                    type="button"
                    disabled={!isAuthed}
                    title={!isAuthed ? "Log in to view following" : ""}
                  >
                    <strong>
                      {statsLoading ? (
                        <span style={{ opacity: 0.75 }}>—</span>
                      ) : (
                        passportStats.following
                      )}
                    </strong>
                    <span>Following</span>
                  </button>
                </div>

                {/* ✅ REPLACED: the 3 empty boxes → Identity Stamps */}
                <div
                  className="pp-idStamps"
                  role="group"
                  aria-label="Passport identity stamps"
                >
                  <div className="pp-idStamp">
                    <div className="pp-idStampTop">
                      <span className="pp-idIcon">🌍</span>
                      <span className="pp-idLabel">Home Base</span>
                    </div>
                    <div className="pp-idValue">{homeBaseLabel}</div>
                  </div>

                  <div className="pp-idStamp">
                    <div className="pp-idStampTop">
                      <span className="pp-idIcon">🛂</span>
                      <span className="pp-idLabel">Traveler Type</span>
                    </div>
                    <div className="pp-idValue">{travelerTypeLabel}</div>
                  </div>

                  <div className="pp-idStamp">
                    <div className="pp-idStampTop">
                      <span className="pp-idIcon">🗓</span>
                      <span className="pp-idLabel">Member Since</span>
                    </div>
                    <div className="pp-idValue">{memberSinceLabel}</div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="pp-heroDivider" />

              {/* CENTER */}
              <div className="pp-heroCol pp-heroCol--center">
                <div className="pp-levelWrap pp-levelWrap--hero">
                  {xpLoading ? (
                    <div style={{ width: 220, margin: "0 auto" }}>
                      <Skeleton active paragraph={{ rows: 2 }} />
                    </div>
                  ) : (
                    <Progress
                      type="dashboard"
                      percent={xpPercent}
                      strokeWidth={10}
                      className="pp-levelRing"
                      format={() => (
                        <div className="pp-levelText">
                          <div className="pp-levelRole">{nextBadgeName}</div>
                          <div className="pp-levelNum">Level {levelNumber}</div>
                          <div className="pp-levelXp">
                            {xp} / {xpGoal} XP
                          </div>
                        </div>
                      )}
                    />
                  )}
                </div>

                <Text className="pp-muted" style={{ fontSize: 12 }}>
                  Next Badge →{" "}
                  <span className="pp-accentText">Globetrotter</span>
                </Text>
              </div>

              {/* Divider */}
              <div className="pp-heroDivider" />

              {/* RIGHT */}
              <div className="pp-heroCol pp-heroCol--right">
                <Title
                  level={3}
                  className="pp-title"
                  style={{ marginBottom: 8 }}
                >
                  Digital Passport
                </Title>

                <span className="pp-pill pp-pill--active">
                  🟠 Passport Active
                </span>

                <Text
                  className="pp-muted"
                  style={{ fontSize: 12, display: "block", marginTop: 10 }}
                >
                  Valid through {passportExpiresLabel}
                </Text>

                {/* ✅ Only ONE music control */}
                <div className="pp-heroActions">
                  <Button
                    className="pp-ghost-btn pp-ghost-btn--music"
                    icon={
                      profileMusic ? <SoundOutlined /> : <PlayCircleOutlined />
                    }
                    onClick={() => setMusicOpen(true)}
                  >
                    {profileMusic ? "Profile Music" : "Add Profile Music"}
                  </Button>

                  <Button
                    className="pp-ghost-btn"
                    icon={<CopyOutlined />}
                    onClick={copyPassportLink}
                  >
                    Copy Link
                  </Button>

                  <Button
                    className="pp-ghost-btn"
                    icon={<ShareAltOutlined />}
                    onClick={() =>
                      antdMessage.info("Sharing enabled post-launch")
                    }
                  >
                    Share
                  </Button>
                </div>

                <Text className="pp-credentialHint">
                  This passport unlocks stamps, borders, and rewards.
                </Text>

                {/* ✅ Gentle, non-salesy upgrade entry (no plan cards here) */}
                <div style={{ marginTop: 10 }}>
                  <Button
                    className="pp-ghost-btn"
                    onClick={goMembership}
                    icon={<RightOutlined />}
                  >
                    Upgrade your Passport
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* =========================
              TABS BAR (mock-style rail)
          ========================= */}
          <Card
            bordered={false}
            className="pp-card pp-tabPanel pp-tabPanel--sticky"
          >
            <Segmented
              value={segment}
              onChange={setSegment}
              options={segmentedOptions}
              block
              className="pp-tabs"
            />
          </Card>

          {/* =========================
              CONTENT (by segment)
          ========================= */}
          {segment === "summary" && (
            <>
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={14}>
                  <Card bordered={false} className="pp-card pp-card--panel">
                    <div className="pp-panelHeader">
                      <Title
                        level={4}
                        className="pp-title"
                        style={{ margin: 0 }}
                      >
                        Highlights
                      </Title>
                      <Text className="pp-muted">
                        A quiet flex — clean and meaningful.
                      </Text>
                    </div>

                    <PassportHighlights />

                    <div style={{ marginTop: 16 }}>
                      <PassportPrivilegesCard />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={10}>
                  {/* ✅ Inner Circle redesigned to match mock */}
                  <Card
                    bordered={false}
                    className="pp-card pp-card--panel pp-innerCircleCard"
                  >
                    <div className="pp-panelHeaderRow pp-innerHeader">
                      <div>
                        <Title
                          level={4}
                          className="pp-title"
                          style={{ margin: 0 }}
                        >
                          Your Inner Circle
                        </Title>
                        <Text
                          className="pp-muted"
                          style={{ display: "block", marginTop: 2 }}
                        >
                          Your top places & people — quick flex, always visible.
                        </Text>
                      </div>

                      <span className="pp-xpChip">0 XP</span>
                    </div>

                    <div className="pp-innerGrid">
                      {innerCircleFriends.slice(0, 3).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="pp-innerTile"
                          onClick={() =>
                            antdMessage.info("Inner Circle details post-launch")
                          }
                        >
                          <div
                            className="pp-innerCover"
                            style={{
                              backgroundImage: it.coverUrl
                                ? `url(${it.coverUrl})`
                                : "linear-gradient(135deg, rgba(120,90,255,.35), rgba(255,138,42,.25))",
                            }}
                          />
                          <div className="pp-innerOverlay" />
                          <div className="pp-innerMeta">
                            <div className="pp-innerName">{it.name}</div>
                            <div className="pp-innerSub">Passport Pick</div>
                          </div>
                        </button>
                      ))}

                      <button
                        type="button"
                        className="pp-innerTile pp-innerTile--add"
                        onClick={() =>
                          antdMessage.info("Add to Inner Circle (post-launch)")
                        }
                      >
                        <div className="pp-innerAddPlus">+</div>
                        <div className="pp-innerAddText">Add</div>
                      </button>
                    </div>

                    <div className="pp-innerDots" aria-hidden="true">
                      <span className="dot isOn" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </Card>
                </Col>
              </Row>

              <div style={{ marginTop: 16 }}>
                <StampStrip />
              </div>

              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={14}>
                  <TopEight
                    title="Places That Define You"
                    subtitle="Top 8 Locations"
                    canEdit={canEditTop8}
                    storageKey={`skyrio_top8_places_${
                      auth?.user?.id || "member"
                    }`}
                    defaultItems={top8Places}
                    renderItem={(item, ctx) => (
                      <TopEightItemPlace
                        {...item}
                        isDragging={ctx.isDragging}
                      />
                    )}
                  />
                </Col>

                <Col xs={24} lg={10}>
                  <SkyrioExchangePreviewCard
                    level={levelNumber}
                    balanceXp={xp}
                    nextLevelGoal={250}
                    featuredDrop="Priority Support Week"
                    ctaLabel="Open Exchange"
                  />
                </Col>
              </Row>

              <AdminQuickControls isAdmin={isAdmin} />
            </>
          )}

          {segment === "journeys" && (
            <>
              <TripList />
              <TravelHistory />
            </>
          )}

          {segment === "borders" && <VisaList />}

          {segment === "vault" && (
            <>
              <Card
                bordered={false}
                className="osq-surface"
                style={{ marginTop: 16 }}
              >
                <Title level={5} style={{ marginBottom: 6 }}>
                  Rewards Vault
                </Title>
                <Text type="secondary">
                  Earn XP from bookings + quests. Redeem it for boosts, badges,
                  and perks.
                </Text>

                <div style={{ marginTop: 12 }}>
                  <Button type="primary" onClick={goMembership}>
                    View Membership Options
                  </Button>
                  <Button
                    style={{ marginLeft: 8 }}
                    onClick={() => setSegment("summary")}
                  >
                    Back to Passport Summary
                  </Button>
                </div>
              </Card>

              <SkyrioExchange showSearch={false} />

              {rewardsEnabled ? (
                <Card
                  style={{ marginTop: 16 }}
                  bordered={false}
                  className="osq-surface"
                >
                  <Title level={5} style={{ marginBottom: 6 }}>
                    Seasonal Rewards
                  </Title>

                  <Text type="secondary">
                    Limited-time XP missions and rewards. You control when
                    seasons go live.
                  </Text>

                  <div style={{ marginTop: 12 }}>
                    <Tag color="gold">Soft Launch</Tag>
                    <Tag color="purple">Coming Soon</Tag>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" disabled style={{ marginRight: 8 }}>
                      View Season Rewards
                    </Button>

                    <Button
                      onClick={() =>
                        antdMessage.info(
                          "Seasonal rewards go live when you turn on a season."
                        )
                      }
                    >
                      How it works
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card
                  style={{ marginTop: 16 }}
                  bordered={false}
                  className="osq-surface"
                >
                  <Title level={5} style={{ marginBottom: 6 }}>
                    Rewards are off
                  </Title>

                  <Text type="secondary">
                    Turn on Rewards to unlock XP missions, badges, and seasonal
                    rewards.
                  </Text>

                  <div style={{ marginTop: 12 }}>
                    <Button
                      type="primary"
                      onClick={() => rewardsOptIn.confirm(true)}
                    >
                      Turn on Rewards
                    </Button>
                  </div>
                </Card>
              )}

              <Card
                style={{ marginTop: 16 }}
                bordered={false}
                className="osq-surface"
              >
                <Title level={5}>Invite & Earn</Title>
                <Space wrap>
                  <Input
                    value={referralCode}
                    readOnly
                    style={{ minWidth: 280 }}
                  />
                  <Button icon={<CopyOutlined />} onClick={copyReferral} />
                  <Button
                    icon={<ShareAltOutlined />}
                    onClick={() =>
                      antdMessage.info("Sharing enabled post-launch")
                    }
                  />
                </Space>
              </Card>
            </>
          )}

          <PassportFooter />
        </div>
      </div>

      <FollowersModal
        open={followOpen}
        onClose={() => setFollowOpen(false)}
        mode={followMode}
      />

      <ProfileMusicModal
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        onSave={setProfileMusic}
        value={profileMusic}
      />
    </>
  );

  return (
    <div className="passport-page">
      {/* FULL-PAGE background */}
      <div
        className="passport-bg"
        style={{ backgroundImage: `url(${passportBg})` }}
        aria-hidden="true"
      />

      {/* All your existing UI goes here */}
      <div className="passport-content">
        <div className="passport-scope">{PassportContent}</div>
      </div>
    </div>
  );
}
