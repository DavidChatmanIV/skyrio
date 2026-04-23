import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

const OPTIN_KEY = "skyrio_rewards_optin_prompted";

export default function useRewardsOptInPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user) return;

    const prompted = localStorage.getItem(OPTIN_KEY);
    const rewardsEnabled = !!user?.settings?.rewardsEnabled;

    if (!prompted && !rewardsEnabled) {
      setOpen(true);
      localStorage.setItem(OPTIN_KEY, "1");
    }
  }, []);

  async function confirm(enabled) {
    try {
      const res = await fetch(apiUrl("/api/profile/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings: { rewardsEnabled: enabled } }),
      });

      if (!res.ok) throw new Error("Failed to update settings");
      const data = await res.json();

      const current = JSON.parse(localStorage.getItem("user") || "{}");
      current.settings = data.settings;
      localStorage.setItem("user", JSON.stringify(current));
    } catch (e) {
      console.error(e);
    } finally {
      setOpen(false);
    }
  }

  return { open, close: () => setOpen(false), confirm };
}
