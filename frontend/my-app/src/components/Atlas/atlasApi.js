// src/components/Atlas/atlasApi.js
// Same auth as AtlasPanel.jsx: Bearer token from localStorage("token").
export const API = import.meta.env.VITE_API_URL || "";

export function authHeaders(withJson = false) {
  const token = localStorage.getItem("token");
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Returns { ok, status, data } and never throws on a bad status.
export async function atlasApi(path, { method = "GET", body } = {}) {
  const hasBody = body !== undefined;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(hasBody),
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
