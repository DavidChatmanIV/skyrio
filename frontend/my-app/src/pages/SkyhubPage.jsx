import React, { useMemo, useState } from "react";
import { Row, Col, Card, Typography, Input, Button, Space } from "antd";
import {
  SearchOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  TagsOutlined,
  StarOutlined,
} from "@ant-design/icons";

import "../styles/skyhub.css";

import LeftRail from "./skyhub/LeftRail";
import MomentsHeader from "./skyhub/MomentsHeader";
import MomentsFilters from "./skyhub/MomentsFilters";
import MomentsFeed from "./skyhub/MomentsFeed";
import RightRail from "./skyhub/RightRail";

import skyhubBeach from "../assets/Skyhub/beach.png";
// Optional: add more images when ready
// import galaxyBg from "../assets/DigitalPassport/galaxy-sunset.png";

const { Text } = Typography;

const SKYHUB_BG_KEY = "skyrio_skyhub_bg_choice";
const SKYHUB_BG_OVERRIDE_KEY = "skyrio_skyhub_bg_override";

/* Phase-1: keep it small. Add more later safely. */
const SKYHUB_BACKGROUNDS = [
  { id: "beach", label: "Beach Sunset", url: skyhubBeach },
  // { id: "galaxy", label: "Galaxy Night", url: galaxyBg },
];

function passportLevelToTheme(level = "Explorer") {
  const v = String(level).toLowerCase();
  if (v.includes("elite") || v.includes("premium")) return "premium";
  if (v.includes("wanderer")) return "wanderer";
  if (v.includes("globe") || v.includes("trotter")) return "globetrotter";
  return "explorer";
}

function themeToGradientVars(theme) {
  switch (theme) {
    case "premium":
      return {
        "--sh-g1": "rgba(18, 10, 30, 0.76)",
        "--sh-g2": "rgba(70, 34, 120, 0.62)",
        "--sh-g3": "rgba(255, 138, 42, 0.22)",
      };
    case "globetrotter":
      return {
        "--sh-g1": "rgba(10, 20, 45, 0.72)",
        "--sh-g2": "rgba(72, 72, 160, 0.58)",
        "--sh-g3": "rgba(255, 138, 42, 0.20)",
      };
    case "wanderer":
      return {
        "--sh-g1": "rgba(18, 10, 30, 0.70)",
        "--sh-g2": "rgba(90, 48, 130, 0.58)",
        "--sh-g3": "rgba(255, 138, 42, 0.18)",
      };
    default: // explorer
      return {
        "--sh-g1": "rgba(40, 18, 70, 0.78)",
        "--sh-g2": "rgba(90, 48, 130, 0.62)",
        "--sh-g3": "rgba(255, 138, 42, 0.28)",
      };
  }
}

export default function SkyHubPage() {
  // Phase-1 tabs (Friends / Trips / Community)
  const [tab, setTab] = useState("Friends");

  // ✅ Example: replace with real passport level later (/api/profile)
  const passportLevel = "Explorer";
  const theme = passportLevelToTheme(passportLevel);
  const gradientVars = themeToGradientVars(theme);

  // Background choice persistence
  const savedBg = localStorage.getItem(SKYHUB_BG_KEY) || "";
  const savedOverride = localStorage.getItem(SKYHUB_BG_OVERRIDE_KEY) === "1";

  const defaultBgId = "beach";
  const [bgId, setBgId] = useState(savedBg || defaultBgId);
  const [userOverride, setUserOverride] = useState(savedOverride);
  const [parallaxOn, setParallaxOn] = useState(true);

  const bg = useMemo(() => {
    return (
      SKYHUB_BACKGROUNDS.find((b) => b.id === bgId) || SKYHUB_BACKGROUNDS[0]
    );
  }, [bgId]);

  return (
    <div
      className={`ss-page ${parallaxOn ? "is-parallax" : ""}`}
      data-theme={theme}
      style={{
        ...gradientVars,
        "--sh-bg-url": `url(${bg.url})`,
      }}
    >
      <div className="ss-overlay" />

      <div className="ss-container">
        {/* ✅ Header (Renamed SkyFeeds → Moments) */}
        <div className="ss-hero">
          <MomentsHeader />
        </div>

        <Row gutter={[18, 18]} align="start">
          {/* LEFT */}
          <Col xs={24} lg={6}>
            <LeftRail />
          </Col>

          {/* CENTER */}
          <Col xs={24} lg={12}>
            {/* ✅ Background controls (Phase-1) */}
            <Card bordered={false} className="ss-card" style={{ padding: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Space wrap size={8}>
                  <Text
                    style={{ fontWeight: 800, color: "rgba(244,246,251,.86)" }}
                  >
                    Background:
                  </Text>

                  {SKYHUB_BACKGROUNDS.map((b) => (
                    <Button
                      key={b.id}
                      className="ss-chip"
                      onClick={() => {
                        setBgId(b.id);
                        setUserOverride(true);
                        localStorage.setItem(SKYHUB_BG_KEY, b.id);
                        localStorage.setItem(SKYHUB_BG_OVERRIDE_KEY, "1");
                      }}
                      style={{
                        borderColor:
                          b.id === bgId ? "rgba(255,155,70,.55)" : undefined,
                      }}
                    >
                      {b.label}
                    </Button>
                  ))}

                  <Button
                    className="ss-chip"
                    onClick={() => {
                      setUserOverride(false);
                      localStorage.removeItem(SKYHUB_BG_KEY);
                      localStorage.setItem(SKYHUB_BG_OVERRIDE_KEY, "0");
                      setBgId(defaultBgId);
                    }}
                  >
                    Reset to Passport Theme
                  </Button>
                </Space>

                <Space size={8}>
                  <Button
                    className="ss-chip"
                    onClick={() => setParallaxOn((v) => !v)}
                  >
                    {parallaxOn ? "Parallax: On" : "Parallax: Off"}
                  </Button>
                </Space>
              </div>
            </Card>

            {/* Top search bar */}
            <Card bordered={false} className="ss-card ss-topbar">
              <div className="ss-topbarRow">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Search SkyHub"
                  className="ss-input"
                />
                <Button className="ss-pillBtn">For You (Passport) ▾</Button>
                <Button className="ss-iconBtn" icon={<StarOutlined />} />
              </div>
            </Card>

            {/* Composer */}
            <Card bordered={false} className="ss-card ss-composer">
              <div className="ss-composeRow">
                <Input
                  placeholder="Share your latest Moment..."
                  className="ss-input"
                />
                <Button className="ss-cta">Post</Button>
              </div>

              <Space wrap size={10} style={{ marginTop: 10 }}>
                <Button className="ss-chip" icon={<PictureOutlined />}>
                  Photo
                </Button>
                <Button className="ss-chip" icon={<VideoCameraOutlined />}>
                  Video
                </Button>
                <Button className="ss-chip" icon={<EnvironmentOutlined />}>
                  Location
                </Button>
                <Button className="ss-chip" icon={<TagsOutlined />}>
                  Travel Tags
                </Button>
                <Button className="ss-chip">Save</Button>
              </Space>
            </Card>

            {/* Filters */}
            <div className="ss-feedTabs">
              <MomentsFilters value={tab} onChange={setTab} />
            </div>

            {/* Notice */}
            <Card bordered={false} className="ss-card ss-notice">
              <Text>
                SkyHub is in demo mode (API not available). Showing sample
                Moments.
              </Text>
            </Card>

            <MomentsFeed filter={tab} />
          </Col>

          {/* RIGHT */}
          <Col xs={24} lg={6}>
            <RightRail />
          </Col>
        </Row>
      </div>
    </div>
  );
}