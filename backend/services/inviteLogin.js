// ─────────────────────────────────────────────────────────────
// Personal sign-in links for Sync Together invite emails.
//
// Each invite email gets its own link: /sync-together/join/<code>?t=<token>.
// The token names ONE invited person (trip + member + email), expires after
// 7 days, and only works while that person hasn't answered the invite yet —
// once they join (or decline), the link stops signing anyone in.
//
// It's signed with a key derived from JWT_SECRET but different from it, so
// an invite token can never be used as a normal login token (and a login
// token can't be passed off as an invite).
// ─────────────────────────────────────────────────────────────
import jwt from "jsonwebtoken";

const KEY = `${process.env.JWT_SECRET || "dev_secret"}::sync-invite-login`;
const PURPOSE = "sync_invite_login";
export const INVITE_LOGIN_DAYS = 7;

export function mintInviteLogin({ groupId, memberId, email }) {
  if (!groupId || !memberId || !email) return null;
  return jwt.sign(
    {
      p: PURPOSE,
      g: String(groupId),
      m: String(memberId),
      e: String(email).trim().toLowerCase(),
    },
    KEY,
    { expiresIn: `${INVITE_LOGIN_DAYS}d` }
  );
}

// Returns { groupId, memberId, email } or null if bad/expired.
export function readInviteLogin(token) {
  try {
    const d = jwt.verify(String(token || ""), KEY);
    if (d?.p !== PURPOSE || !d.g || !d.m || !d.e) return null;
    return { groupId: d.g, memberId: d.m, email: d.e };
  } catch {
    return null;
  }
}
