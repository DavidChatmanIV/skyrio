// Adds the members-only Passport covers to the rewards catalog at startup if
// they're missing (on, since they work as soon as this code is deployed).
// Never overwrites an item that already exists, so edits or a removal made in
// the admin rewards screen stick.
import RewardItem from "../models/rewardItem.js";
import { MEMBER_REWARDS } from "../config/passportCovers.js";

export async function ensureMemberRewards() {
  let added = 0;
  for (const item of MEMBER_REWARDS) {
    const r = await RewardItem.updateOne(
      { itemId: item.itemId },
      { $setOnInsert: { ...item, active: true, level: 1, featured: false, repeatable: false } },
      { upsert: true }
    );
    if (r.upsertedCount) added++;
  }
  if (added) console.log(`[rewards] added ${added} members-only reward(s)`);
}
