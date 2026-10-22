import { Card } from "antd";
import { Sparkles, TrendingUp, Radar, Flame } from "lucide-react";
import "@/styles/AtlasInsightCard.css";

// Labels describe what the card is — an Atlas tip — without claiming it's
// "live" data. Pass `trend` only when the message really comes from live
// numbers on the page (e.g. trend="From today's prices").
function getToneMeta(tone = "smart") {
  const normalized = String(tone || "smart").toLowerCase();

  if (normalized === "warn") {
    return {
      badge: "Atlas · Heads-up",
      icon: <Flame size={18} aria-hidden="true" />,
      title: "Watch your budget",
      className: "is-warn",
    };
  }

  if (normalized === "trend") {
    return {
      badge: "Atlas · Trend",
      icon: <TrendingUp size={18} aria-hidden="true" />,
      title: "Worth knowing",
      className: "is-trend",
    };
  }

  if (normalized === "deep") {
    return {
      badge: "Atlas · Analysis",
      icon: <Radar size={18} aria-hidden="true" />,
      title: "A closer look at your trip",
      className: "is-deep",
    };
  }

  return {
    badge: "Atlas AI",
    icon: <Sparkles size={18} aria-hidden="true" />,
    title: "Trip tip",
    className: "is-smart",
  };
}

function clampMessage(message = "", max = 220) {
  const text = String(message || "").trim();

  if (!text) {
    return "Pick a destination and dates, and Atlas will share tips for your trip here.";
  }

  if (text.length <= max) return text;

  return `${text.slice(0, max).trim()}…`;
}

export default function AtlasInsightCard({
  message,
  tone = "smart",
  trend = "Atlas tip",
}) {
  const toneMeta = getToneMeta(tone);
  const safeMessage = clampMessage(message, 220);

  return (
    <Card
      variant="borderless"
      className={`atlasInsightCard atlasInsightInlineCard ${toneMeta.className}`}
      styles={{ body: { padding: 0 } }}
      role="note"
      aria-label={`${toneMeta.badge}: ${toneMeta.title}`}
    >
      <div className="atlasInsightCardTop">
        <div className="atlasInsightCardIconWrap">{toneMeta.icon}</div>

        <div className="atlasInsightCardHeaderCopy">
          <div className="atlasInsightCardEyebrow">{toneMeta.badge}</div>
          <div className="atlasInsightCardTitle">{toneMeta.title}</div>
        </div>

        {trend && <div className="atlasInsightCardTrend">{trend}</div>}
      </div>

      <div className="atlasInsightCardBody">
        <p className="atlasInsightCardMessage">{safeMessage}</p>
      </div>
    </Card>
  );
}
