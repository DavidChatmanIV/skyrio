import { Card } from "antd";
import {
  ThunderboltOutlined,
  RiseOutlined,
  RadarChartOutlined,
  FireOutlined,
} from "@ant-design/icons";
import "@/styles/AtlasInsightCard.css";

function getToneMeta(tone = "smart") {
  const normalized = String(tone || "smart").toLowerCase();

  if (normalized === "warn") {
    return {
      badge: "Atlas warning",
      icon: <FireOutlined />,
      title: "Budget-sensitive signal",
      className: "is-warn",
    };
  }

  if (normalized === "trend") {
    return {
      badge: "Atlas trend",
      icon: <RiseOutlined />,
      title: "Live trend insight",
      className: "is-trend",
    };
  }

  if (normalized === "deep") {
    return {
      badge: "Atlas analysis",
      icon: <RadarChartOutlined />,
      title: "Deeper trip analysis",
      className: "is-deep",
    };
  }

  return {
    badge: "Atlas AI",
    icon: <ThunderboltOutlined />,
    title: "Smart trip insight",
    className: "is-smart",
  };
}

function clampMessage(message = "", max = 220) {
  const text = String(message || "").trim();

  if (!text) {
    return "Atlas is watching your trip flow and will surface smarter guidance as you explore.";
  }

  if (text.length <= max) return text;

  return `${text.slice(0, max).trim()}…`;
}

export default function AtlasInsightCard({
  message,
  tone = "smart",
  trend = "Live insight",
}) {
  const toneMeta = getToneMeta(tone);
  const safeMessage = clampMessage(message, 220);

  return (
    <Card
      bordered={false}
      className={`atlasInsightCard atlasInsightInlineCard ${toneMeta.className}`}
      bodyStyle={{ padding: 0 }}
    >
      <div className="atlasInsightCardTop">
        <div className="atlasInsightCardIconWrap">{toneMeta.icon}</div>

        <div className="atlasInsightCardHeaderCopy">
          <div className="atlasInsightCardEyebrow">{toneMeta.badge}</div>
          <div className="atlasInsightCardTitle">{toneMeta.title}</div>
        </div>

        <div className="atlasInsightCardTrend">{trend}</div>
      </div>

      <div className="atlasInsightCardBody">
        <p className="atlasInsightCardMessage">{safeMessage}</p>
      </div>
    </Card>
  );
}