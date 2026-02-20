import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Avatar,
  Button,
  Progress,
  message as antdMessage,
  Skeleton,
  Tag, // ✅ required (fixes Tag is not defined)
} from "antd";
import {
  UserOutlined,
  CopyOutlined,
  ShareAltOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { io } from "socket.io-client";

/* ✅ IMPORTANT: Passport styling */
import "../../styles/profile-passport.css";

/* 🌍 Background */
import passportBg from "../../assets/DigitalPassport/worldmap.png";

/* 🎵 Profile music */
import ProfileMusicModal, {
  SKYRIO_PROFILE_MUSIC_KEY,
} from "./music/ProfileMusicModal";

/* Social */
import FollowersModal from "./FollowersModal";

/* Auth */
import { useAuth } from "../../auth/useAuth";

/* Rewards */
import RewardsOptInPrompt from "../../components/rewards/RewardsOptInPrompt";
import useRewardsOptInPrompt from "../../hooks/useRewardsOptInPrompt";

const { Title, Text } = Typography;

/* ---------------- helpers ---------------- */
function safeEmailPrefix(email) {
  if (!email) return "";
  const idx = email.indexOf("@");
  return idx > 0 ? email.slice(0, idx) : email;
}

export default function DigitalPassportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const rewardsOptIn = useRewardsOptInPrompt();

  const isAuthed = !!auth?.user;
  const myId = useMemo(() => {
    const u = auth?.user;
    return u?._id || u?.id || null;
  }, [auth?.user]);

  /* UI */
  const [musicOpen, setMusicOpen] = useState(false);
  const [profileMusic, setProfileMusic] = useState(null);

  /* Data */
  const [xpLoading, setXpLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [xp, setXp] = useState(0);
  const [xpToNextBadge, setXpToNextBadge] = useState(0);
  const [nextBadgeName, setNextBadgeName] = useState("Explorer");

  const [passportStats, setPassportStats] = useState({
    followers: 0,
    following: 0,
  });

  const [followOpen, setFollowOpen] = useState(false);
  const [followMode, setFollowMode] = useState("following");

  const socketRef = useRef(null);

  /* ---------------- derived ---------------- */
  const displayName = useMemo(() => {
    const u = auth?.user;
    if (!u) return "Explorer";
    return u.username || u.name || safeEmailPrefix(u.email) || "Explorer";
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

  const homeBaseLabel = useMemo(() => {
    const hb = auth?.user?.homeBase;
    if (hb && typeof hb === "string") return hb;
    return "New Jersey";
  }, [auth?.user?.homeBase]);

  const xpGoal = useMemo(() => {
    const current = Number(xp || 0);
    const remaining = Number(xpToNextBadge || 0);
    const goal = remaining > 0 ? current + remaining : Math.max(100, current);
    return Math.max(1, goal);
  }, [xp, xpToNextBadge]);

  const xpPercent = useMemo(() => {
    const current = Number(xp || 0);
    return Math.max(0, Math.min(100, Math.round((current / xpGoal) * 100)));
  }, [xp, xpGoal]);

  /* ✅ transition toast after auth redirect */
  useEffect(() => {
    const fromAuth = !!location?.state?.fromAuth;
    if (!fromAuth) return;

    antdMessage.success({
      content: `Welcome aboard${auth?.user?.name ? `, ${auth.user.name}` : ""} ✈️`,
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

  /* ---------- profile xp ---------- */
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
        setNextBadgeName(String(data?.nextBadgeName ?? "Explorer"));
      } catch {
        if (!mounted) return;
        setXp(0);
        setXpToNextBadge(0);
        setNextBadgeName("Explorer");
      } finally {
        if (mounted) setXpLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  /* ---------- passport stats ---------- */
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

  /* ---------------- actions ---------------- */
  const copyPassportLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      antdMessage.success("Passport link copied");
    } catch {
      antdMessage.error("Copy failed");
    }
  }, []);

  const onShare = useCallback(() => {
    antdMessage.info("Sharing enabled post-launch");
  }, []);

  /* ---------------- mock data for visual match ---------------- */
  const journeys = useMemo(
    () => [
      {
        id: "tokyo",
        name: "Tokyo",
        last: "Sep 2021",
        img: "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1200&q=70",
      },
      {
        id: "paris",
        name: "Paris",
        last: "2021",
        img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=70",
      },
      {
        id: "rome",
        name: "Rome",
        last: "Dec 2025",
        img: "https://images.unsplash.com/photo-1526481280695-3c687fd5432c?auto=format&fit=crop&w=1200&q=70",
      },
      {
        id: "miami",
        name: "Miami",
        last: "Aug 2025",
        img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=70",
      },
    ],
    []
  );

  const partners = useMemo(
    () => [
      {
        id: "p1",
        name: "Marcus",
        trips: "2 Trips Together",
        last: "Last Trip: Miami (Dec 2025)",
      },
      {
        id: "p2",
        name: "Sarah",
        trips: "1 Trip Together",
        last: "Last Trip: Cancun (Aug 2025)",
      },
    ],
    []
  );

  return (
    <div className="passport-page">
      {/* ✅ Skyrio Gradient Defs (safe to keep) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="skyrioGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8C3C" />
            <stop offset="100%" stopColor="#8B5CFF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Background */}
      <div
        className="passport-bg"
        style={{ backgroundImage: `url(${passportBg})` }}
        aria-hidden="true"
      />

      <div className="passport-content">
        <RewardsOptInPrompt
          open={rewardsOptIn.open}
          onClose={rewardsOptIn.close}
          onConfirm={rewardsOptIn.confirm}
        />

        <div className="passport-scope">
          <div className="pp-page">
            <div className="pp-shell">
              {/* HOME button (mock top-left) */}
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

              {/* ✅ MOCK GRID: Left main + Right sidebar */}
              <div className="pp-mockGrid">
                {/* ============ LEFT MAIN ============ */}
                <div className="pp-mockMain">
                  {/* Top: Profile strip (matches mock left top) */}
                  <Card bordered={false} className="pp-card pp-profileCard">
                    <div className="pp-profileRow">
                      <div className="pp-profileAvatar">
                        <Avatar size={92} icon={<UserOutlined />} />
                      </div>

                      <div className="pp-profileMeta">
                        <Title level={2} className="pp-title" style={{ margin: 0 }}>
                          {displayName}
                        </Title>

                        <Text className="pp-muted">
                          {handle} · Level {levelNumber}
                        </Text>

                        <div style={{ marginTop: 10 }}>
                          <span className="pp-pill pp-pill--active">🟠 Passport Active</span>
                        </div>

                        <div className="pp-followRow pp-followRow--mock">
                          <button
                            className="ppFollowBtn"
                            onClick={() => {
                              setFollowMode("followers");
                              setFollowOpen(true);
                            }}
                            type="button"
                            disabled={!isAuthed}
                          >
                            <strong>
                              {statsLoading ? <span style={{ opacity: 0.75 }}>—</span> : passportStats.followers}
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
                          >
                            <strong>
                              {statsLoading ? <span style={{ opacity: 0.75 }}>—</span> : passportStats.following}
                            </strong>
                            <span>Following</span>
                          </button>
                        </div>
                      </div>

                      {/* Center ring (sits inside same top band like mock) */}
                      <div className="pp-profileRing">
                        {xpLoading ? (
                          <div style={{ width: 190 }}>
                            <Skeleton active paragraph={{ rows: 2 }} />
                          </div>
                        ) : (
                          <Progress
                            type="dashboard"
                            percent={xpPercent}
                            strokeWidth={10}
                            className="pp-levelRing pp-levelRing--mock"
                            format={() => (
                              <div className="pp-levelText">
                                <div className="pp-levelRole">{nextBadgeName}</div>
                                <div className="pp-levelNum">Level {levelNumber}</div>
                                <div className="pp-levelXp">{xp} XP</div>
                              </div>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Home base label row like mock */}
                  <div className="pp-homeBaseRow">
                    <span className="pp-homeBaseDot" />
                    <span className="pp-homeBaseLabel">Home Base</span>
                    <span className="pp-homeBaseSep">·</span>
                    <span className="pp-homeBaseValue">{homeBaseLabel}</span>
                  </div>

                  {/* Travel Soundtrack card (matches mock middle band) */}
                  <Card bordered={false} className="pp-card pp-soundtrackCard">
                    <div className="pp-soundtrackRow">
                      <div
                        className="pp-soundtrackCover"
                        style={{
                          backgroundImage: profileMusic?.artworkUrl
                            ? `url(${profileMusic.artworkUrl})`
                            : "url(https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=1200&q=70)",
                        }}
                      />
                      <div className="pp-soundtrackMeta">
                        <div className="pp-soundtrackTitle">Travel Soundtrack</div>
                        <div className="pp-soundtrackSub">Lo-Fi Japan Playlist</div>
                        <div className="pp-soundtrackTiny">Tokyo Trip · Sep 2021</div>

                        <div className="pp-audioBar">
                          <div className="pp-audioProgress" style={{ width: "42%" }} />
                        </div>

                        <div className="pp-audioControls">
                          <button type="button" className="pp-audioBtn" aria-label="Previous">
                            ⏮
                          </button>
                          <button
                            type="button"
                            className="pp-audioBtn pp-audioBtn--main"
                            aria-label="Play"
                            onClick={() => setMusicOpen(true)}
                          >
                            ⏯
                          </button>
                          <button type="button" className="pp-audioBtn" aria-label="Next">
                            ⏭
                          </button>

                          <div className="pp-audioWave" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Travel Journeys carousel card */}
                  <Card bordered={false} className="pp-card pp-journeysCard">
                    <div className="pp-journeysHeader">
                      <div className="pp-journeysTitle">Travel Journeys</div>
                    </div>

                    <div className="pp-journeysGrid">
                      {journeys.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          className="pp-journeyTile"
                          onClick={() => antdMessage.info("Journeys go live post-launch")}
                        >
                          <div
                            className="pp-journeyImg"
                            style={{ backgroundImage: `url(${j.img})` }}
                          />
                          <div className="pp-journeyOverlay" />
                          <div className="pp-journeyText">
                            <div className="pp-journeyName">{j.name}</div>
                            <div className="pp-journeyLast">Last Trip: {j.last}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="pp-viewAll"
                      onClick={() => antdMessage.info("View all journeys (post-launch)")}
                    >
                      View All Journeys <span className="pp-arrow">→</span>
                    </button>
                  </Card>
                </div>

                {/* ============ RIGHT SIDEBAR ============ */}
                <div className="pp-mockSide">
                  {/* Digital Passport actions (exact buttons from mock) */}
                  <Card bordered={false} className="pp-card pp-actionsCard">
                    <Title level={3} className="pp-title" style={{ marginBottom: 4 }}>
                      Digital Passport
                    </Title>

                    <div className="pp-actionsStack">
                      <Button
                        className="pp-actionBtn"
                        icon={profileMusic ? <SoundOutlined /> : <PlayCircleOutlined />}
                        onClick={() => setMusicOpen(true)}
                      >
                        {profileMusic ? "Profile Music" : "Add Profile Music"}
                      </Button>

                      <Button
                        className="pp-actionBtn"
                        icon={<CopyOutlined />}
                        onClick={copyPassportLink}
                      >
                        Copy Link
                      </Button>

                      <Button className="pp-actionBtn" icon={<ShareAltOutlined />} onClick={onShare}>
                        Share
                      </Button>
                    </div>

                    <Text className="pp-credentialHint">
                      This passport unlocks stamps, borders, and rewards.
                    </Text>

                    <Button
                      className="pp-upgradeBtn"
                      onClick={() => navigate("/membership")}
                    >
                      Upgrade your Passport
                    </Button>
                  </Card>

                  {/* Travel Partners card */}
                  <Card bordered={false} className="pp-card pp-partnersCard">
                    <div className="pp-partnersTitle">
                      <span className="pp-partnersIcon">✈︎</span>
                      Travel Journeys
                    </div>

                    <div className="pp-partnerList">
                      {partners.map((p) => (
                        <div key={p.id} className="pp-partnerItem">
                          <div className="pp-partnerAvatar">
                            <Avatar size={34} icon={<UserOutlined />} />
                          </div>
                          <div className="pp-partnerMeta">
                            <div className="pp-partnerName">
                              {displayName} · {p.name}
                            </div>
                            <div className="pp-partnerSub">{p.trips}</div>
                            <div className="pp-partnerTiny">{p.last}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="pp-inviteBtn"
                      onClick={() => antdMessage.info("Invite travel partner (post-launch)")}
                    >
                      + Invite Travel Partner
                    </Button>
                  </Card>

                  {/* Optional: little tag like mock-ish (safe) */}
                  <div style={{ marginTop: 10, opacity: 0.95 }}>
                    <Tag className="pp-tag ppTagDark">Soft Launch</Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    </div>
  );
}