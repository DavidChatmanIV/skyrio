import { useEffect } from "react";

// While someone scrolls on a phone, the floating Help and Atlas buttons
// fade and shrink so they don't cover what's being read. They come back
// a moment after scrolling stops. Adds/removes `fab-quiet` on <html>.
export default function useQuietFabs({ maxWidth = 640, idleMs = 600 } = {}) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const root = document.documentElement;
    let timer = null;
    const onScroll = () => {
      if (window.innerWidth > maxWidth) return;
      root.classList.add("fab-quiet");
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove("fab-quiet"), idleMs);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      root.classList.remove("fab-quiet");
    };
  }, [maxWidth, idleMs]);
}
