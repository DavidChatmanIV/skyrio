import React, { useState } from "react";
import { HeartOutlined, HeartFilled, LoadingOutlined } from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth";
import { useAuthModal } from "../../auth/useAuthModal";
import { apiUrl } from "@/lib/api";

export default function SaveTripButton({
  tripData = {},
  onSaveConfirmed,
  onSaveError,
  size = "middle",
  variant = "solid",
  label = "Save Trip",
}) {
  const auth = useAuth();
  const { openAuthModal } = useAuthModal();

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!auth?.user) {
      openAuthModal({ intent: "save", redirectTo: "/booking" });
      return;
    }

    if (saved) return;

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const payload = {
        tripType: tripData.tripType ?? "custom",
        title: tripData.title ?? "Untitled Trip",
        destination: tripData.destination ?? "",
        image: tripData.image ?? "",
        price: tripData.price ?? 0,
        currency: tripData.currency ?? "USD",
        startDate: tripData.startDate ?? "",
        endDate: tripData.endDate ?? "",
        metadata: tripData.metadata ?? {},
      };

      const res = await fetch(apiUrl("/api/saved-trips"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to save trip");
      }

      setSaved(true);
      onSaveConfirmed?.(data.savedTrip);
    } catch (err) {
      onSaveError?.(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isGhost = variant === "ghost";
  const isSmall = size === "small";

  const icon = loading ? (
    <LoadingOutlined />
  ) : saved ? (
    <HeartFilled style={{ color: "#ff8a2a" }} />
  ) : (
    <HeartOutlined />
  );

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={loading || saved}
      className={
        isGhost
          ? `sk-save-btn-ghost${saved ? " is-saved" : ""}`
          : `sk-save-btn${saved ? " is-saved" : ""}`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 4 : 6,
        fontSize: isSmall ? 12 : 14,
        padding: isSmall ? "4px 10px" : "6px 16px",
        borderRadius: 20,
        border: isGhost
          ? "1px solid rgba(255,138,42,0.35)"
          : "1px solid transparent",
        background: isGhost
          ? "rgba(255,138,42,0.08)"
          : "linear-gradient(135deg, #ff8a2a, #ffb066)",
        color: isGhost ? "rgba(255,255,255,0.75)" : "#fff",
        cursor: loading || saved ? "default" : "pointer",
        opacity: loading ? 0.7 : 1,
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}
    >
      {icon}
      {saved ? "Saved" : label}
    </button>
  );
}