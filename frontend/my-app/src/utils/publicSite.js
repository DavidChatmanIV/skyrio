// The address people see in shared links and texts. Shares should always
// show www.myskyrio.com, never a preview host like *.vercel.app.
const MAIN_SITE = "https://www.myskyrio.com";

export function publicSite() {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (fromEnv && !/\.vercel\.app$/i.test(new URL(fromEnv).hostname)) return fromEnv;
  if (typeof window === "undefined") return MAIN_SITE;
  const host = window.location.hostname;
  if (/(^|\.)myskyrio\.com$/i.test(host)) return window.location.origin;
  return MAIN_SITE;
}

export default publicSite;
