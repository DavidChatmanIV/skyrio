import React, { useState } from "react";
import { Card, Button, Progress, Typography, Image } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

const badgeTitles = [
  "New Explorer",
  "Wanderer",
  "Trailblazer",
  "Globetrotter",
  "Jet Setter",
  "World Builder",
];

const XPBadgeCard = () => {
  const [xp, setXp] = useState(0);
  const level = Math.floor(xp / 100) + 1;

  const getBadgeIcon = (lvl) => `/images/badges/badge-${Math.min(lvl, 6)}.png`;

  const getLevelTitle = (lvl) => {
    const index = Math.max(0, Math.min(lvl - 1, badgeTitles.length - 1));
    return badgeTitles[index];
  };

  return (
    <Card title="🏆 XP & Badge Progress" variant="borderless">
      <Text strong>
        Level {level}: {getLevelTitle(level)}
      </Text>
      <div className="my-4">
        <Image
          src={getBadgeIcon(level)}
          alt="Level Badge"
          width={100}
          fallback="/images/badges/badge-1.png"
        />
      </div>
      <Progress
        percent={xp % 100}
        status="active"
        strokeColor="#52c41a"
        className="mb-3"
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setXp((prev) => prev + 10)}
      >
        +10 XP
      </Button>
    </Card>
  );
};

export default XPBadgeCard;
