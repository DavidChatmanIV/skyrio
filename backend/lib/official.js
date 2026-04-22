import User from "../models/user.js";

const OFFICIAL_EMAIL = (
  process.env.OFFICIAL_EMAIL || "official@skyrio.com"
).toLowerCase();
const OFFICIAL_USERNAME = (
  process.env.OFFICIAL_USERNAME || "skyrio"
).toLowerCase();
const OFFICIAL_NAME = process.env.OFFICIAL_NAME || "Skyrio Official";

export async function getOrCreateOfficialUser() {
  let official = await User.findOne({ isOfficial: true });

  if (!official) {
    official = await User.findOneAndUpdate(
      { email: OFFICIAL_EMAIL },
      {
        $setOnInsert: {
          email: OFFICIAL_EMAIL,
          username: OFFICIAL_USERNAME,
          name: OFFICIAL_NAME,
          role: "official",
          isOfficial: true,
          followersCount: 0,
          followingCount: 0,
          preferences: { officialUpdatesMuted: false },
        },
      },
      { new: true, upsert: true }
    );

    // Ensure flags if found by email but not set
    if (!official.isOfficial) {
      official.isOfficial = true;
      official.role = "official";
      await official.save();
    }
  }

  return official;
}
