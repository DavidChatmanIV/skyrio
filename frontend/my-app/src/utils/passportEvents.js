const PASSPORT_EVENT_MAP = {
  SEARCH_EXECUTED: "trip_planned",
  TRIP_SAVED: "trip_saved",
  BUDGET_UPDATED: "budget_checked",
  BOOKING_COMPLETED: "booking_completed",
  SKYHUB_POSTED: "skyhub_posted",
  AI_TRIP_USED: "ai_trip_used",
  PROFILE_COMPLETED: "profile_completed",
};

export async function trackPassportEvent(type, meta = {}) {
  const mappedType = PASSPORT_EVENT_MAP[type] || type;

  if (!mappedType) {
    console.warn("Passport event missing type:", type);
    return null;
  }

  try {
    const res = await fetch("/api/passport/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        type: mappedType,
        meta,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || "Passport event request failed");
    }

    return data;
  } catch (err) {
    console.warn("Passport event failed:", err);
    return null;
  }
}