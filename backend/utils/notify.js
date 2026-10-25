// Everything that creates a bell notification goes through here.
//
// Types the frontend knows about (keep these names in sync with Notifications.jsx):
//   sync_invite   — someone invited you to a Sync Together trip
//   group_message — lives in utils/notifyGroupMessage.js (not here)
//   post_like     — likes on your SkyHub post (collapsed per post)
//   post_comment  — comments on your SkyHub post (collapsed per post)
//
// Requires MongoDB 4.2+ (pipeline updates).

import mongoose from "mongoose";
// Lowercase on purpose — the file is models/notification.js and Render (Linux) is case-sensitive
import Notification from "../models/notification.js";
// Same room server.js joins on "notifications:join" (plain userId)
import { userRoom } from "./notifyGroupMessage.js";

const oid = (id) => new mongoose.Types.ObjectId(String(id));
// Wrap strings so values starting with "$" aren't read as field paths in pipeline updates
const lit = (v) => (typeof v === "string" ? { $literal: v } : v);
const same = (a, b) => String(a) === String(b);

/* ── Shared plumbing ──────────────────────────────────────────────── */

async function emitNew(io, userId, doc) {
  const unread = await Notification.countDocuments({
    user: oid(userId),
    read: false,
  });
  // Spread the doc at the top level — the frontend reads _id, title, message from here.
  io?.to(userRoom(userId)).emit("notification:new", { ...doc, unread });
}

// "Fernanda", "Fernanda + 1 other", "Fernanda + 2 others"
function names(first, othersCount) {
  if (!othersCount) return first;
  return `${first} + ${othersCount} other${othersCount > 1 ? "s" : ""}`;
}

/**
 * One-off notification (no collapsing).
 */
export async function notify(
  io,
  { to, from, type, title, message, targetType, targetId, link }
) {
  if (!to || same(to, from)) return null; // never notify yourself
  const n = await Notification.create({
    user: to,
    type,
    title,
    message,
    targetType,
    targetId,
    link,
    read: false,
  });
  await emitNew(io, to, n.toObject());
  return n;
}

/**
 * Collapsing notification: bumps the existing unread one with the same
 * user + type + match, or creates it. Atomic, so simultaneous events
 * can't create duplicates.
 *   match       — fields that identify "the same thing" (e.g. { group } or { targetId })
 *   set         — fields to store (link, targetType, ...)
 *   actorName   — who did it this time (kept in senders, newest first, max 3)
 *   buildText   — (doc) => { title, message } from the collapsed state
 */
async function upsertCollapsed(
  io,
  { userId, type, match, set = {}, actorName, buildText }
) {
  const pipelineSet = {
    user: oid(userId),
    type: lit(type),
    read: false,
    count: { $add: [{ $ifNull: ["$count", 0] }, 1] },
    senders: {
      $slice: [
        {
          $concatArrays: [
            [lit(actorName)],
            {
              $filter: {
                input: { $ifNull: ["$senders", []] },
                cond: { $ne: ["$$this", lit(actorName)] },
              },
            },
          ],
        },
        3,
      ],
    },
    createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
    updatedAt: "$$NOW",
  };
  for (const [k, v] of Object.entries({ ...match, ...set }))
    pipelineSet[k] = lit(v);

  const n = await Notification.findOneAndUpdate(
    { user: oid(userId), type, read: false, ...match },
    [{ $set: pipelineSet }],
    {
      upsert: true,
      new: true,
      lean: true,
      timestamps: false,
      updatePipeline: true, // Mongoose 9 rejects pipeline updates without this
    }
  );

  const { title, message } = buildText(n);
  await Notification.updateOne(
    { _id: n._id },
    { $set: { title, message } },
    { timestamps: false }
  );
  await emitNew(io, userId, { ...n, title, message });
}

/* ── Sync Together ────────────────────────────────────────────────── */

/** Call after an invite is created. */
export function notifySyncInvite(
  io,
  { inviteeId, inviterId, inviterName, tripId, tripName }
) {
  return notify(io, {
    to: inviteeId,
    from: inviterId,
    type: "sync_invite",
    title: `${inviterName} invited you to ${tripName || "a group trip"}`,
    message: "Tap to view the trip and respond.",
    targetType: "sync",
    targetId: tripId,
    link: `/sync-together/${tripId}`,
  });
}

/* ── SkyHub ───────────────────────────────────────────────────────── */

/** Call after a like is added (not on unlike). */
export function notifyPostLike(
  io,
  { postId, postAuthorId, likerId, likerName, postPreview }
) {
  if (same(postAuthorId, likerId)) return null;
  return upsertCollapsed(io, {
    userId: postAuthorId,
    type: "post_like",
    match: { targetId: oid(postId) },
    set: { targetType: "post", link: `/skyhub/post/${postId}` },
    actorName: likerName,
    buildText: ({ senders = [], count = 1 }) => ({
      title: `${names(senders[0], count - 1)} liked your post`,
      message: postPreview ? `"${postPreview.slice(0, 80)}"` : "",
    }),
  });
}

/** Call after a comment is saved. */
export function notifyPostComment(
  io,
  { postId, postAuthorId, commenterId, commenterName, commentPreview }
) {
  if (same(postAuthorId, commenterId)) return null;
  return upsertCollapsed(io, {
    userId: postAuthorId,
    type: "post_comment",
    match: { targetId: oid(postId) },
    set: { targetType: "post", link: `/skyhub/post/${postId}` },
    actorName: commenterName,
    buildText: ({ senders = [], count = 1 }) => ({
      title:
        count === 1
          ? `${senders[0]} commented on your post`
          : `${count} new comments on your post`,
      message: commentPreview
        ? `${commenterName}: ${commentPreview.slice(0, 80)}`
        : "",
    }),
  });
}
