import User from "../models/user.js";

/**
 * Checks if two users mutually follow each other (A follows B AND B follows A).
 *
 * NOTE: as of follow.routes.js, the Follow collection is not written to —
 * follow/unfollow operate directly on User.following/User.followers arrays.
 * This checks those arrays directly rather than the Follow collection,
 * since that's the actual source of truth right now.
 *
 * If Follow.js turns out to be used elsewhere (another routes file, a
 * script, etc.), that needs reconciling separately — having two models
 * that look like sources of truth for the same relationship, where only
 * one is actually kept up to date, is a drift risk worth resolving.
 */
export async function isMutualFollow(userIdA, userIdB) {
  if (!userIdA || !userIdB) return false;
  if (String(userIdA) === String(userIdB)) return false;

  const [aFollowsB, bFollowsA] = await Promise.all([
    User.exists({ _id: userIdA, following: userIdB }),
    User.exists({ _id: userIdB, following: userIdA }),
  ]);

  return Boolean(aFollowsB && bFollowsA);
}
