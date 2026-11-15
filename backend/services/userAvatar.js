// One answer to "what's this person's photo right now?", used everywhere.
//
// Photos have lived in two places: the account (User.avatar) and the older
// Profile (Profile.avatar). The public Passport preferred Profile, SkyHub
// used User or the copy saved on each post when it was made, so the same
// person could show a photo on one page and initials on another.
//
// Rule: Profile photo if set, else account photo, else none. A default
// placeholder ("/default-avatar.png", "TR", initials) counts as none.
import User from "../models/user.js";
import Profile from "../models/profile.js";

/** A real photo link, or null for placeholders. */
export function realPhoto(v) {
  const s = String(v || "").trim();
  if (!s || s === "/default-avatar.png") return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("/uploads/")) return s;
  return null; // "TR", "DA", emoji… are placeholders, not photos
}

/** userIds → Map(id → photo url | null). Never throws. */
export async function photosFor(ids, { UserModel = User, ProfileModel = Profile } = {}) {
  const list = [...new Set((ids || []).map((x) => String(x || "")).filter((x) => /^[a-f0-9]{24}$/i.test(x)))];
  const out = new Map(list.map((id) => [id, null]));
  if (!list.length) return out;
  try {
    const [users, profiles] = await Promise.all([
      UserModel.find({ _id: { $in: list } }).select("avatar profilePicture").lean(),
      ProfileModel.find({ user: { $in: list } }).select("user avatar").lean(),
    ]);
    for (const u of users) out.set(String(u._id), realPhoto(u.avatar) || realPhoto(u.profilePicture));
    for (const p of profiles) {
      const photo = realPhoto(p.avatar);
      if (photo) out.set(String(p.user), photo);
    }
  } catch {
    /* fall back to whatever the caller already had */
  }
  return out;
}

/**
 * Once after startup: copy a Profile photo onto the account when the
 * account has none, so every page that reads User.avatar shows it too.
 */
export async function syncProfilePhotos({ UserModel = User, ProfileModel = Profile, limit = 2000 } = {}) {
  const profiles = await ProfileModel.find({ avatar: { $regex: /^(https?:\/\/|\/uploads\/)/i } })
    .select("user avatar")
    .limit(limit)
    .lean();
  let fixed = 0;
  for (const p of profiles) {
    if (!p.user) continue;
    const r = await UserModel.updateOne(
      {
        _id: p.user,
        $or: [
          { avatar: { $exists: false } },
          { avatar: null },
          { avatar: "" },
          { avatar: "/default-avatar.png" },
          { avatar: { $not: /^(https?:\/\/|\/uploads\/)/i } },
        ],
      },
      { $set: { avatar: p.avatar } }
    );
    fixed += r.modifiedCount ?? r.nModified ?? 0;
  }
  return { checked: profiles.length, fixed };
}

export function startPhotoSync({ delayMs = 15_000 } = {}) {
  const t = setTimeout(() => {
    syncProfilePhotos()
      .then((r) => r.fixed && console.log(`[photos] copied ${r.fixed} profile photo(s) to accounts`))
      .catch((e) => console.warn("[photos] sync failed:", e.message));
  }, delayMs);
  t.unref?.();
}
