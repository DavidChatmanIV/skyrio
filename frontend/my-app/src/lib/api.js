// Direct backend address (Render). Use this for Socket.IO and anything else
// that needs a live connection, since the Vercel proxy can't carry sockets.
export const API_BASE = import.meta.env.VITE_API_URL || "";
export const SOCKET_URL = API_BASE;

// On the live site (and Vercel previews), send normal API calls to
// "/api/..." on the same site. vercel.json forwards them to Render, so the
// browser only ever talks to myskyrio.com and login cookies work in every
// browser (including Safari). Locally, keep calling the backend directly.
const onProxiedSite =
  typeof window !== "undefined" &&
  /(^|\.)myskyrio\.com$|\.vercel\.app$/i.test(window.location.hostname);

const HTTP_BASE = onProxiedSite ? "" : API_BASE;

export const apiUrl = (path) => `${HTTP_BASE}${path}`;
