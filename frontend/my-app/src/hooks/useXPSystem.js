/**
 * ─────────────────────────────────────────────────────────────
 * Connects to the real Skyrio backend XP API.
 *
 * BACKEND ENDPOINTS REQUIRED (add to backend/routes/xp.js):
 *   GET  /api/xp/me              → { xp, plan, streak, tier, nextTier, progress, recentEvents, multiplier }
 *   POST /api/xp/activity        → body: { type: "DAILY_SESSION" | "ACTIVE_INTERVAL" | "PAGE_VISIT", path? }
 *                                  → { awarded: bool, xp: <new total>, event?: { label, xp, icon } }
 *
 * PASSIVE TRACKING (handled here automatically):
 *   • DAILY_SESSION   — fires once on mount; backend dedupes to 1/day and
 *                       also handles streak math + milestone bonuses
 *   • ACTIVE_INTERVAL — fires every 5 min while hook is mounted; backend caps at 5/day
 *   • PAGE_VISIT      — call trackPageVisit(path) on every route change; backend caps at 10/day
 *                       (the path is sent so the backend can check its page whitelist)
 *
 * RANK vs BALANCE:
 *   xp          — spendable balance (drops when rewards are redeemed)
 *   totalEarned — lifetime XP. Tier/rank/progress ALWAYS come from this,
 *                 so redeeming a reward can never lower someone's rank.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  XP_PASSIVE,
  getTier,
  getNextTier,
  getTierProgress,
} from "../config/xpConfig";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const ACTIVE_INTERVAL_MS = XP_PASSIVE.ACTIVE_INTERVAL.intervalMs; // 5 min

// ─── Internal fetch helper ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token"); // swap to cookie/context if needed
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`XP API ${path} → ${res.status}`);
  return res.json();
}

// Lifetime XP from any backend response shape (falls back to balance for old responses).
const earnedFrom = (res, fallback = 0) =>
  res?.totalEarned ?? res?.xpTotalEarned ?? fallback;

const tierState = (earned) => ({
  tier: getTier(earned),
  nextTier: getNextTier(earned),
  progress: getTierProgress(earned),
});

// ─── Hook ─────────────────────────────────────────────────────────────────────
export default function useXPSystem() {
  const [data, setData] = useState({
    xp: 0,
    plan: "free",
    streak: 0,
    tier: getTier(0),
    nextTier: getNextTier(0),
    progress: 0,
    multiplier: 1,
    recentEvents: [],
    totalEarned: 0,
    loading: true,
    error: null,
  });

  const intervalRef = useRef(null);
  const visitedPages = useRef(new Set());
  const sessionFired = useRef(false);

  // ── Fetch full XP state from backend ──────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/xp/me");
      const totalEarned = earnedFrom(res, res.xp ?? 0);
      setData((prev) => ({
        ...prev,
        ...res,
        totalEarned,
        ...tierState(totalEarned),
        loading: false,
        error: null,
      }));
    } catch (err) {
      setData((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  // ── Post a passive or active activity event ───────────────────────────────
  // `extra` carries additional fields the backend needs (e.g. { path } for PAGE_VISIT).
  // Returns the XP event object if XP was actually awarded, else null.
  const awardActivity = useCallback(async (type, extra = {}) => {
    try {
      const res = await apiFetch("/api/xp/activity", {
        method: "POST",
        body: JSON.stringify({ type, ...extra }),
      });

      if (res.awarded) {
        setData((prev) => {
          // Passive XP is never pending, so lifetime grows by exactly what was awarded.
          const totalEarned = earnedFrom(
            res,
            prev.totalEarned + (res.event?.xp ?? 0)
          );
          return {
            ...prev,
            xp: res.xp,
            totalEarned,
            ...tierState(totalEarned),
            recentEvents: res.event
              ? [res.event, ...prev.recentEvents].slice(0, 12)
              : prev.recentEvents,
          };
        });
        return res.event ?? null;
      }
      return null;
    } catch {
      // Passive tracking should never surface errors to the user
      return null;
    }
  }, []);

  // ── Session start on mount ─────────────────────────────────────────────────
  useEffect(() => {
    refresh(); // load initial state

    if (!sessionFired.current) {
      sessionFired.current = true;
      // Backend: once per calendar day. Streak + streak bonuses are handled
      // inside the daily session, so no separate STREAK_DAY call is needed.
      awardActivity("DAILY_SESSION");
    }
  }, [refresh, awardActivity]);

  // ── Active-time interval (every 5 min) ────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      awardActivity("ACTIVE_INTERVAL"); // backend: dailyLimit 5
    }, ACTIVE_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [awardActivity]);

  // ── Page-visit tracking ───────────────────────────────────────────────────
  // Call this in a useEffect on every route change:
  //   const { trackPageVisit } = useXPSystem();
  //   useEffect(() => { trackPageVisit(location.pathname); }, [location.pathname]);
  const trackPageVisit = useCallback(
    (path) => {
      if (!visitedPages.current.has(path)) {
        visitedPages.current.add(path);
        awardActivity("PAGE_VISIT", { path }); // backend: dailyLimit 10, whitelist-checked
      }
    },
    [awardActivity]
  );

  // ── Active action award ───────────────────────────────────────────────────
  // NOTE: bookings are awarded server-side only (Stripe webhook → awardXpForBooking).
  // This only reports client activity; the backend decides whether it counts.
  const awardXP = useCallback((type) => awardActivity(type), [awardActivity]);

  return {
    // State
    xp: data.xp,
    plan: data.plan,
    streak: data.streak,
    tier: data.tier,
    nextTier: data.nextTier,
    progress: data.progress,
    multiplier: data.multiplier,
    recentEvents: data.recentEvents,
    totalEarned: data.totalEarned,
    loading: data.loading,
    error: data.error,
    // Actions
    refresh,
    // After a redemption: lower the balance only — rank stays put.
    setBalance: (xp) => setData((prev) => ({ ...prev, xp })),
    awardXP,
    trackPageVisit,
  };
}
