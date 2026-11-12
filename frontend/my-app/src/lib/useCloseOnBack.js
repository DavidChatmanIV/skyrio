// For screens drawn over a page (checkout over the results, the "choose
// your return flight" step…): the browser Back button or a swipe back
// closes the screen instead of leaving the page. Opening it adds one
// history step; Back takes it away and calls onClose. Closing it with the
// screen's own button removes the step too, so the next Back isn't a dead
// press.
//
//   useCloseOnBack(!!selected, () => setSelected(null));
//
// Each screen marks its own step (history.state.skLayers), so several can
// stack: Back closes only the top one, like going back page by page.
import { useEffect, useRef } from "react";

let nextId = 1;
const layersNow = () => {
  const l = window.history.state?.skLayers;
  return Array.isArray(l) ? l : [];
};

export default function useCloseOnBack(open, onClose) {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `l${nextId++}`;
  const stepRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = idRef.current;
    if (open && !stepRef.current) {
      stepRef.current = true;
      try {
        window.history.pushState(
          {
            ...(window.history.state || {}),
            skOverlay: true,
            skLayers: [...layersNow(), id],
          },
          ""
        );
      } catch {
        /* history unavailable: Back works as before */
      }
    } else if (!open && stepRef.current) {
      stepRef.current = false;
      // Closed with the screen's own button: drop our step if it's on top.
      const l = layersNow();
      if (l[l.length - 1] === id) window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (!stepRef.current || layersNow().includes(idRef.current)) return;
      stepRef.current = false;
      closeRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
