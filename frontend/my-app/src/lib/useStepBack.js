// Back / swipe back inside a step-by-step screen (checkout: travelers →
// seats → pay) goes to the previous step instead of leaving the screen.
//
//   useStepBack(step, setStep);
//
// Moving forward adds one history step per move (so a jump that skips a
// step, like 0 → 2 for flights without seat maps, comes back to 0 in one
// press). Going back with the screen's own button removes the steps
// above, so Back never lands on a stale step.
//
// window.__skStepDepth is how many steps are stacked right now; a page
// that closes this screen with its own button goes back that many extra.
import { useEffect, useRef } from "react";

export default function useStepBack(step, setStep) {
  const baseRef = useRef(step); // the step this screen opened on
  const stackRef = useRef([]); // steps we pushed, oldest first
  const setRef = useRef(setStep);
  setRef.current = setStep;

  const sync = () => {
    window.__skStepDepth = stackRef.current.length;
  };

  useEffect(() => {
    const stack = stackRef.current;
    const top = stack.length ? stack[stack.length - 1] : baseRef.current;
    if (step === top) return;
    if (step > top) {
      try {
        window.history.pushState(
          { ...(window.history.state || {}), skStepAt: step },
          ""
        );
        stack.push(step);
      } catch {
        /* history unavailable */
      }
    } else {
      // Went back with the screen's own button: remove the steps above it.
      let n = 0;
      while (stack.length && stack[stack.length - 1] > step) {
        stack.pop();
        n++;
      }
      if (n) window.history.go(-n);
      if (stack.length && stack[stack.length - 1] < step) {
        // Landed on a step we never pushed (rare): add it so Back works.
        try {
          window.history.pushState(
            { ...(window.history.state || {}), skStepAt: step },
            ""
          );
          stack.push(step);
        } catch {
          /* ignore */
        }
      }
    }
    sync();
  }, [step]);

  useEffect(() => {
    const onPop = () => {
      const at = window.history.state?.skStepAt;
      const target = typeof at === "number" ? at : baseRef.current;
      const stack = stackRef.current;
      // Drop the steps we're no longer on.
      while (stack.length && stack[stack.length - 1] > target) stack.pop();
      sync();
      setRef.current(target);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Reset after the page that closed this screen has read the depth
      // (its effect runs right after this cleanup).
      setTimeout(() => {
        window.__skStepDepth = 0;
      }, 0);
    };
  }, []);
}
