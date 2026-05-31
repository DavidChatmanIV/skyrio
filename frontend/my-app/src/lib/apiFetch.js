import { apiUrl } from "./api";

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  return fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}
