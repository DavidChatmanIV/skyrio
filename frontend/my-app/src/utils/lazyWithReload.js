// Drop-in replacement for React.lazy that survives deploys.
//
// After a new deploy, a visitor on the old build can request hashed chunks
// that no longer exist. Two things then go wrong:
//   1. main.jsx's vite:preloadError handler calls preventDefault() and
//      reloads. Vite then resolves the import with `undefined`, and React.lazy
//      crashes reading `.default` before the reload finishes
//      (Sentry: "undefined is not an object (evaluating 'v._result.default')").
//   2. The import itself rejects
//      (Sentry: "Importing a module script failed").
// In both cases we reload once and keep the Suspense spinner up meanwhile.
import { lazy } from "react";

const KEY = "skyrio-chunk-reload"; // same key main.jsx uses
const never = () => new Promise(() => {});

function reloadOnce() {
  try {
    if (sessionStorage.getItem(KEY) === "1") return false;
    sessionStorage.setItem(KEY, "1");
  } catch {
    return false; // storage blocked: don't risk a reload loop
  }
  window.location.reload();
  return true;
}

export function lazyWithReload(factory) {
  return lazy(() =>
    factory().then(
      // undefined = main.jsx handler is already reloading; just wait
      (mod) => (mod?.default ? mod : never()),
      // the import itself failed
      (err) => (reloadOnce() ? never() : Promise.reject(err))
    )
  );
}
