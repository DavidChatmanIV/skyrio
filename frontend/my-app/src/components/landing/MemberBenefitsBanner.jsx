import React, { useMemo } from "react";
import { Button, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { LockOutlined, CheckCircleOutlined } from "@ant-design/icons";

// If you have this hook already, use it:
import { useAuth } from "../../auth/useAuth";

const { Text } = Typography;

export default function MemberBenefitsBanner() {
  const navigate = useNavigate();
  const { user } = useAuth?.() || { user: null };

  const perks = useMemo(
    () => [
      "Member-only deals",
      "XP rewards",
      "Price-drop alerts",
      "Saved trips + faster checkout",
    ],
    []
  );

  // Guest view (Expedia vibe: “unlock savings/features”)
  if (!user) {
    return (
      <div className="lp-memberWrap">
        <div className="lp-memberCard">
          <div className="lp-memberLeft">
            <div className="lp-memberTitle">
              <LockOutlined /> Unlock member features
            </div>
            <Text className="lp-memberSub">
              Sign in to get {perks.join(" • ")}.
            </Text>
          </div>

          <div className="lp-memberRight">
            <Button
              className="lp-memberBtn"
              type="primary"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
            <Button
              className="lp-memberLink"
              type="link"
              onClick={() => navigate("/membership")}
            >
              Learn more
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Signed-in view (reassurance: perks active)
  return (
    <div className="lp-memberWrap">
      <div className="lp-memberCard lp-memberCard--active">
        <div className="lp-memberLeft">
          <div className="lp-memberTitle">
            <CheckCircleOutlined /> Member perks active
          </div>
          <Text className="lp-memberSub">
            Your account is signed in — XP, alerts, and saved trips are enabled.
          </Text>
        </div>

        <div className="lp-memberRight">
          <Button
            className="lp-memberBtnGhost"
            onClick={() => navigate("/passport")}
          >
            View Passport
          </Button>
        </div>
      </div>
    </div>
  );
}