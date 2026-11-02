import { useEffect, useState } from "react";

/* ── One popup at a time ─────────────────────────────────────────
   On a first visit the cookie banner, the tour, onboarding, the rewards
   opt-in, the rank-share card and the help/Atlas tips could all open at
   once. Anything that pops up on its own (not because the user clicked)
   waits its turn with useQuietTurn(): it opens only after nothing else
   has been on screen for a moment.

   A popup can also announce itself, so others wait for it:
     announcePopup("my-id", true)  … announcePopup("my-id", false)
   (SupportRail listens for the same "skyrio:popup" event.) */

const MODAL_SELECTOR = [
  ".ant-modal-wrap",
  ".ant-drawer-open",
  "[aria-modal='true']",
  "[data-skyrio-popup]",
].join(",");
// Name-based guesses — only count when floating over the page, so a
// footer "Cookie policy" link never blocks anything.
const FLOATING_SELECTOR = [
  "[class*='cookie' i]",
  "[id*='cookie' i]",
  "[class*='onboarding' i]",
  "[class*='dtour' i]",
  "[class*='skyrio-tour' i]",
].join(",");

const claimed = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("skyrio:popup", (e) => {
    const { id, open } = e.detail || {};
    if (!id) return;
    if (open) claimed.add(id);
    else claimed.delete(id);
  });
}

export function announcePopup(id, open) {
  try {
    window.dispatchEvent(
      new CustomEvent("skyrio:popup", { detail: { id, open: !!open } })
    );
  } catch {
    /* very old browser: nothing waits, nothing breaks */
  }
}

function visible(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return null;
  if (Number(cs.opacity) === 0) return null;
  return cs;
}

/** Is any other popup on screen? `ignoreId` skips your own claim. */
export function otherPopupOpen(ignoreId) {
  for (const id of claimed) if (id !== ignoreId) return true;
  try {
    for (const el of document.querySelectorAll(
      `${MODAL_SELECTOR},${FLOATING_SELECTOR}`
    )) {
      if (el.closest("[data-sr-root]")) continue; // help rail's own pieces
      const cs = visible(el);
      if (!cs) continue;
      if (
        !el.matches(MODAL_SELECTOR) &&
        cs.position !== "fixed" &&
        cs.position !== "sticky"
      )
        continue;
      return true;
    }
  } catch {
    /* selector unsupported: don't block */
  }
  return false;
}

/**
 * true once `wanted` is true AND nothing else has been open for `quietMs`.
 * Stops checking once it turns true, so your own popup opening doesn't
 * flip it back.
 */
export function useQuietTurn(wanted, { quietMs = 1200, id } = {}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!wanted) {
      setReady(false);
      return;
    }
    if (ready) return;
    let quietSince = null;
    const tick = () => {
      if (otherPopupOpen(id)) {
        quietSince = null;
        return;
      }
      if (quietSince == null) quietSince = Date.now();
      if (Date.now() - quietSince >= quietMs) setReady(true);
    };
    tick();
    const t = setInterval(tick, 300);
    return () => clearInterval(t);
  }, [wanted, ready, quietMs, id]);
  return ready;
}
