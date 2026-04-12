import React from "react";
import { Button } from "antd";
import { HeartOutlined, HeartFilled } from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth";
import { useAuthModal } from "../../auth/useAuthModal";

/**
 * SaveTripButton
 * Props:
 *   onSaveConfirmed – callback fired after successful save
 *   size            – "small" | "middle" | "large" (default "middle")
 *   variant         – "ghost" | "solid" (default "solid")
 *   label           – button text (default "Save Trip")
 */
export default function SaveTripButton({
  onSaveConfirmed,
  size = "middle",
  variant = "solid",
  label = "Save Trip",
}) {
  const auth = useAuth();
  const { openAuthModal } = useAuthModal();

  function handleSave() {
    // If not logged in, open auth modal and bail
    if (!auth?.user) {
      openAuthModal({ intent: "save", redirectTo: "/booking" });
      return;
    }

    // Logged in — fire the confirmed callback
    onSaveConfirmed?.();
  }

  const isGhost = variant === "ghost";

  return (
    <Button
      size={size}
      onClick={handleSave}
      className={isGhost ? "sk-save-btn-ghost" : "sk-save-btn"}
      icon={<HeartOutlined />}
    >
      {label}
    </Button>
  );
}