/**
 * lib/membershipApi.js
 * Calls the /api/billing routes. Sends the auth cookie AND the Bearer token
 * (if one is stored), so it works with either auth style.
 */

const API = import.meta.env.VITE_API_URL || "https://skyrio.onrender.com";

function authHeaders() {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("skyrio_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.code = data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const startCheckout = (plan, billing) =>
  call("/api/billing/checkout-session", { method: "POST", body: JSON.stringify({ plan, billing }) });

export const openBillingPortal = () => call("/api/billing/portal-session", { method: "POST" });

export const getBillingStatus = (sessionId) =>
  call(`/api/billing/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`);

/** Keep the cached user in localStorage in step with the real plan. */
export function cacheUserPlan(plan) {
  try {
    const raw = localStorage.getItem("user");
    if (raw) localStorage.setItem("user", JSON.stringify({ ...JSON.parse(raw), plan }));
  } catch {}
}

export const PLAN_NAMES = { free: "Free", explorer: "Explorer", legend: "Legend" };

export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
