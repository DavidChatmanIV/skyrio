// The address people see in shared links, texts and emails. A preview
// host like *.vercel.app is never shown; www.myskyrio.com is used instead.
const MAIN_SITE = "https://www.myskyrio.com";

export function pickPublicSite(...candidates) {
  for (const raw of candidates) {
    const v = String(raw || "").split(",")[0].trim().replace(/\/+$/, "");
    if (!v) continue;
    let host;
    try {
      host = new URL(v).hostname;
    } catch {
      continue;
    }
    if (/\.vercel\.app$/i.test(host)) continue;
    return v;
  }
  return MAIN_SITE;
}

export const PUBLIC_SITE = pickPublicSite(
  process.env.PUBLIC_SITE_URL,
  process.env.FRONTEND_URL
);

export default PUBLIC_SITE;
