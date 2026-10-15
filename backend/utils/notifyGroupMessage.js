// Sync Together group texts → notification bell, fitted to your existing Notification schema.
import Notification from "../models/notification.js";

// Matches server.js "notifications:join" → socket.join(String(userId))
export const userRoom = (userId) => String(userId);
// Room joined by the optional "group:join" socket event in server.js
export const groupRoom = (groupId) => `group:${groupId}`;

// The group chat page checks GET /:id/chat every few seconds. Each check
// records "this person is reading this chat right now".
const VIEWING_WINDOW_MS = 20 * 1000;
const lastViewed = new Map(); // "groupId:userId" → timestamp

export function markViewing(groupId, userId) {
  lastViewed.set(`${groupId}:${userId}`, Date.now());
  // Keep the map from growing forever
  if (lastViewed.size > 5000) {
    const cutoff = Date.now() - VIEWING_WINDOW_MS;
    for (const [k, t] of lastViewed) if (t < cutoff) lastViewed.delete(k);
  }
}

// Skip anyone who already has the group chat open.
async function isViewingGroup(io, groupId, userId) {
  const t = lastViewed.get(`${groupId}:${userId}`);
  if (t && Date.now() - t < VIEWING_WINDOW_MS) return true;
  if (!io) return false;
  const sockets = await io.in(groupRoom(groupId)).fetchSockets();
  return sockets.some((s) => String(s.data?.userId) === String(userId));
}

function buildMessage(senders, count, preview) {
  if (count === 1 && preview) return `${senders[0]}: ${preview.slice(0, 80)}`;
  const [first, ...rest] = senders;
  const who = rest.length
    ? `${first} + ${rest.length} other${rest.length > 1 ? "s" : ""}`
    : first;
  return count === 1
    ? `${who} sent a message`
    : `${who}: ${count} new messages`;
}

async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, read: false });
}

/**
 * Call right after a Sync Together group message is saved.
 * One unread notification per user per group — new texts update it instead of stacking.
 */
export async function notifyGroupMessage(
  io,
  { groupId, groupName, senderId, senderName, preview, memberIds }
) {
  const gid = String(groupId);
  const recipients = [
    ...new Set(
      memberIds
        .filter(Boolean)
        .map((id) => String(id?._id || id))
        .filter((id) => id !== String(senderId))
    ),
  ];

  await Promise.all(
    recipients.map(async (userId) => {
      try {
        if (await isViewingGroup(io, gid, userId)) return;

        // Atomic upsert so rapid-fire texts don't create duplicates
        const n = await Notification.findOneAndUpdate(
          {
            user: userId,
            type: "group_message",
            "metadata.groupId": gid,
            read: false,
          },
          {
            $inc: { "metadata.count": 1 },
            $set: { title: groupName, link: `/sync-together/${gid}` },
            $setOnInsert: { message: "New message", "metadata.senders": [] },
          },
          { upsert: true, new: true }
        );

        const senders = [
          senderName,
          ...(n.metadata?.senders || []).filter((s) => s !== senderName),
        ].slice(0, 3);
        const count = n.metadata?.count || 1;

        const updated = await Notification.findByIdAndUpdate(
          n._id,
          {
            $set: {
              "metadata.senders": senders,
              message: buildMessage(senders, count, preview),
            },
          },
          { new: true }
        );

        io?.to(userRoom(userId)).emit("notification:new", {
          ...updated.toObject(),
          unread: await unreadCount(userId),
        });
      } catch (err) {
        console.error("notifyGroupMessage error:", err);
      }
    })
  );
}

/** Call when a user opens a group chat so its bell entry clears. */
export async function markGroupRead(io, userId, groupId) {
  const result = await Notification.updateMany(
    {
      user: userId,
      type: "group_message",
      "metadata.groupId": String(groupId),
      read: false,
    },
    { $set: { read: true } }
  );
  // The chat polls every few seconds — only refresh the bell when something actually cleared
  if (!result.modifiedCount) return;
  io?.to(userRoom(userId)).emit("notification:unread", {
    unread: await unreadCount(userId),
  });
}
