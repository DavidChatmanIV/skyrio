import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useQuietTurn } from "@/lib/popupQueue";

const OPTIN_KEY = "skyrio_rewards_optin_prompted";

function readUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function useRewardsOptInPrompt() {
  // Should we ask at all? (signed in, never asked, rewards not on yet)
  const [wanted, setWanted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const user = readUser();
    if (!user) return;
    let prompted = false;
    try {
      prompted = !!localStorage.getItem(OPTIN_KEY);
    } catch {
      /* storage blocked */
    }
    const rewardsEnabled = !!user?.settings?.rewardsEnabled;
    if (!prompted && !rewardsEnabled) setWanted(true);
  }, []);

  // Wait until onboarding, the cookie banner etc. are closed, so this
  // doesn't stack on top of them on a first login.
  const myTurn = useQuietTurn(wanted, { quietMs: 1000 });

  useEffect(() => {
    if (!myTurn || !wanted) return;
    setOpen(true);
    setWanted(false);
    // Only marked as asked once it was actually on screen.
    try {
      localStorage.setItem(OPTIN_KEY, "1");
    } catch {
      /* storage blocked: may ask again next visit */
    }
  }, [myTurn, wanted]);

  async function confirm(enabled) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl("/api/profile/settings"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // The rest of the site logs in with this token; without it the
          // choice wasn't saved for token-only sessions.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ settings: { rewardsEnabled: enabled } }),
      });

      if (!res.ok) throw new Error("Couldn't update settings. Try again.");
      const data = await res.json();

      const current = readUser() || {};
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
