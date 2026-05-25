/**
 * ─────────────────────────────────────────────────────────────
 * Connects to the real Skyrio backend XP API.
 *
 * BACKEND ENDPOINTS REQUIRED (add to backend/routes/xp.js):
 *   GET  /api/xp/me              → { xp, plan, streak, tier, nextTier, progress, recentEvents, multiplier }
 *   POST /api/xp/activity        → body: { type: "DAILY_SESSION" | "ACTIVE_INTERVAL" | "PAGE_VISIT" | ... }
 *                                  → { awarded: bool, xp: <new total>, event?: { label, xp, icon } }
 *
 * PASSIVE TRACKING (handled here automatically):
 *   • DAILY_SESSION   — fires once on mount; backend dedupes to 1/day
 *   • ACTIVE_INTERVAL — fires every 5 min while hook is mounted; backend caps at 5/day
 *   • PAGE_VISIT      — call trackPageVisit(path) on every route change; backend caps at 10/day
 *   • STREAK_DAY      — fires on mount; backend handles streak math + milestone bonuses
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
      setData((prev) => ({
        ...prev,
        ...res,
        tier: getTier(res.xp),
        nextTier: getNextTier(res.xp),
        progress: getTierProgress(res.xp),
        loading: false,
        error: null,
      }));
    } catch (err) {
      setData((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  // ── Post a passive or active activity event ───────────────────────────────
  // Returns the XP event object if XP was actually awarded, else null.
  const awardActivity = useCallback(async (type) => {
    try {
      const res = await apiFetch("/api/xp/activity", {
        method: "POST",
        body: JSON.stringify({ type }),
      });

      if (res.awarded) {
        setData((prev) => ({
          ...prev,
          xp: res.xp,
          tier: getTier(res.xp),
          nextTier: getNextTier(res.xp),
          progress: getTierProgress(res.xp),
          recentEvents: res.event
            ? [res.event, ...prev.recentEvents].slice(0, 12)
            : prev.recentEvents,
        }));
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
      awardActivity("DAILY_SESSION"); // backend: once per calendar day
      awardActivity("STREAK_DAY"); // backend: increments streak, awards milestones
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
        awardActivity("PAGE_VISIT"); // backend: dailyLimit 10
      }
    },
    [awardActivity]
  );

  // ── Active action award ───────────────────────────────────────────────────
  // Call this at explicit event points, e.g. after booking:
  //   awardXP("BOOKING_CONFIRMED")
  // Backend maps the type key → xpRules.js amount + applies multiplier.
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
    awardXP,
    trackPageVisit,
  };
}
