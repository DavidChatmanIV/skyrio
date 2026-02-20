import React, { useMemo, useState } from "react";
import { Card, Button, Progress, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import SkyrioBadgeIcon from "../../components/dashboard/SkyrioBadgeIcon"; 

const { Text } = Typography;

const badgeTitles = [
  "New Explorer",
  "Wanderer",
  "Trailblazer",
  "Globetrotter",
  "Jet Setter",
  "World Builder",
];

function iconForLevel(level) {
  if (level >= 6) return "sparkle";
  if (level >= 5) return "globe";
  if (level >= 4) return "firstFlight";
  if (level >= 3) return "explorer";
  if (level >= 2) return "pin";
  return "explorer";
}

export default function XPBadgeCard() {
  const [xp, setXp] = useState(0);

  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;

  const title = useMemo(() => {
    const idx = Math.max(0, Math.min(level - 1, badgeTitles.length - 1));
    return badgeTitles[idx];
  }, [level]);

  return (
    <Card
      title="🏆 XP & Badge Progress"
      variant="borderless"
      className="xp-badge-card"
    >
      <Text strong>
        Level {level}: {title}
      </Text>

      {/* Badge Icon */}
      <div className="xp-badge-iconWrap">
        <SkyrioBadgeIcon type={iconForLevel(level)} size={74} />
      </div>

      {/* XP Progress */}
      <Progress
        percent={progress}
        showInfo={false}
        className="xp-badge-progress"
      />

      <Text className="xp-badge-sub">{progress} / 100 XP to next level</Text>

      {/* Demo Button (remove later if needed) */}
      <div style={{ marginTop: 12 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setXp((p) => p + 10)}
        >
          +10 XP
        </Button>
      </div>
    </Card>
  );
}