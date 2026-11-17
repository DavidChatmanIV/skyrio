// A part of a page that loads only when it's shown (checkout, Atlas cards…),
// so it isn't in the first download. Same props as the real component;
// shows `fallback` for the moment it takes to load. Survives deploys
// (see lazyWithReload).
import { Suspense } from "react";
import { lazyWithReload } from "./lazyWithReload";

export function lazyPart(factory, fallback = null) {
  const Lazy = lazyWithReload(factory);
  function LazyPart(props) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return LazyPart;
}

// A quiet "Loading…" line for checkouts.
export const LoadingLine = (
  <div role="status" style={{ padding: "48px 16px", textAlign: "center", color: "rgba(255,255,255,.7)" }}>
    Loading…
  </div>
);
