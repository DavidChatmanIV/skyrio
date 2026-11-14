import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

// The live travel alert (disruption mode), shared by every component that
// asks for it: one request per minute for the whole page, not one each.

let current = { active: false };
let loadedAt = 0;
let inflight = null;
const listeners = new Set();
const REFRESH_MS = 60_000;

async function load() {
  if (inflight) return inflight;
  inflight = fetch(apiUrl("/api/site-status"))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j) {
        current = j.active ? j : { active: false };
        loadedAt = Date.now();
        listeners.forEach((fn) => fn(current));
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default function useSiteStatus() {
  const [status, setStatus] = useState(current);
  useEffect(() => {
    listeners.add(setStatus);
    if (Date.now() - loadedAt > REFRESH_MS) load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      listeners.delete(setStatus);
      clearInterval(t);
    };
  }, []);
  return status;
}

/** "Flight booking is paused…" text for a booking tab, or "". */
export function pausedMessage(status, vertical) {
  if (!status?.active || !status.paused?.[vertical]) return "";
  const what = { flights: "Flight", hotels: "Hotel", cars: "Car rental" }[vertical];
  return `${what} booking is paused right now: ${status.title}. Try again later.`;
}
