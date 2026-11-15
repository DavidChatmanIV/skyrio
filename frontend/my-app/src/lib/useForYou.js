import { useEffect, useState } from "react";
import { atlasApi } from "@/components/Atlas/atlasApi";

// What Atlas knows (GET /api/atlas/for-you), shared by everything on the
// page so it's asked once: { enabled, lines, ask, nextTrip }.
let cache = null; // { at, promise }
const FRESH_MS = 60 * 1000;

function load() {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.promise;
  const promise = atlasApi("/api/atlas/for-you")
    .then(({ ok, data }) => (ok ? data : null))
    .catch(() => null);
  cache = { at: Date.now(), promise };
  return promise;
}

export default function useForYou(enabled = true) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    let signedIn = false;
    try {
      signedIn = Boolean(localStorage.getItem("token"));
    } catch {
      /* private mode */
    }
    if (!enabled || !signedIn) return undefined;
    load().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return data;
}
