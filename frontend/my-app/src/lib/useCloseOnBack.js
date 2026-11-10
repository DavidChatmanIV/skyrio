// For screens drawn over a page (checkout over the results): the browser
// Back button or a swipe back closes the screen instead of leaving the
// page. Opening it adds one history step; Back takes it away and calls
// onClose. Closing it with the screen's own button removes the step too,
// so the next Back isn't a dead press.
//
//   useCloseOnBack(!!selected, () => setSelected(null));
import { useEffect, useRef } from "react";

export default function useCloseOnBack(open, onClose) {
  const stepRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open && !stepRef.current) {
      stepRef.current = true;
      try {
        window.history.pushState(
          { ...(window.history.state || {}), skOverlay: true },
          ""
        );
      } catch {
        /* history unavailable: Back works as before */
      }
    } else if (!open && stepRef.current) {
      stepRef.current = false;
      if (window.history.state?.skOverlay) window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (!stepRef.current || window.history.state?.skOverlay) return;
      stepRef.current = false;
      closeRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
