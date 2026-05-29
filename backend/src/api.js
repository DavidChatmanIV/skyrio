const API_BASE = "/api";

export async function saveTrip(trip) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/trips/save-trip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(trip),
  });

  if (!res.ok) throw new Error("Failed to save trip");
  return res.json();
}
