// The admin login token, sent as an X-Admin-Token header on admin calls.
// The admin cookie alone fails when the browser blocks cross-site cookies
// (myskyrio.com → onrender.com), so every admin page sends this too.
//
// Saved by the admin login page. Works with either:
//   localStorage "admin_token"            (saveAdminToken below), or
//   localStorage "admin" = {..., token}   (the login response's admin object)

const KEY = "admin_token";

export function saveAdminToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
  } catch {
    /* storage blocked: the cookie may still work */
  }
}

export function getAdminToken() {
  try {
    const direct = localStorage.getItem(KEY);
    if (direct) return direct;
    const admin = JSON.parse(localStorage.getItem("admin") || "null");
    return admin?.token || null;
  } catch {
    return null;
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Header object to spread into fetch headers. Empty when not logged in. */
export function adminTokenHeader() {
  const t = getAdminToken();
  return t ? { "X-Admin-Token": t } : {};
}
