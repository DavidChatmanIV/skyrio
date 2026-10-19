// frontend/my-app/src/utils/sharePassport.js
//
// WHY "NOTHING HAPPENS" TODAY (one of these, usually #1):
//  1. The click handler does `await fetch(...)` BEFORE navigator.share(). Browsers only allow
//     share() inside the user's click gesture; after an await it throws NotAllowedError,
//     and a bare try/catch hides it.
//  2. navigator.share is missing (desktop Chrome on macOS often lacks it) and there's no fallback.
//  3. The modal's onClose fires on the same click and unmounts before the handler runs.
//
// FIX: build the URL synchronously from data you already have, call share() first thing,
// and ALWAYS fall back to copy-link so the button never silently does nothing.

export function buildPassportShareUrl(username, ref) {
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || "https://myskyrio.com";
  const url = new URL(`/p/${encodeURIComponent(username)}`, base);
  if (ref) url.searchParams.set("ref", ref); // your referral code → XP grant on signup
  return url.toString();
}

/** Returns "shared" | "copied" | "cancelled" | "failed" */
export async function sharePassport({ username, rankName, refCode }) {
  const url = buildPassportShareUrl(username, refCode);
  const data = {
    title: `I'm a ${rankName} on Skyrio`,
    text: `I just hit ${rankName} on my Skyrio travel passport ✈️ Come plan your next trip with me:`,
    url,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);          // must be first await in the click handler
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled"; // user closed the sheet
      console.warn("[share] native share failed, falling back:", err);
    }
  }

  try {
    await navigator.clipboard.writeText(`${data.text} ${url}`);
    return "copied";
  } catch {
    // Last-resort fallback for old browsers / non-secure contexts
    const ta = Object.assign(document.createElement("textarea"), { value: `${data.text} ${url}` });
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok ? "copied" : "failed";
  }
}

export function socialLinks({ url, text }) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  return {
    x:        `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    sms:      `sms:?&body=${t}%20${u}`,
    email:    `mailto:?subject=${encodeURIComponent("Join me on Skyrio")}&body=${t}%20${u}`,
  };
}
