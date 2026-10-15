// backend/utils/notify.js
import Notification from "../models/Notification.js";

// Is this user currently in the group's chat room? (assumes chat sockets join `group:${groupId}`
// and every socket has socket.data.userId set on auth)
async function isViewingGroup(io, groupId, userId) {
  const sockets = await io.in(`group:${groupId}`).fetchSockets();
  return sockets.some((s) => String(s.data.userId) === String(userId));
}

function summarize(senders, count, groupName) {
  const [first, ...rest] = senders;
  const who = rest.length
    ? `${first} + ${rest.length} other${rest.length > 1 ? "s" : ""}`
    : first;
  return {
    title: groupName,
    body:
      count === 1 ? `${who} sent a message` : `${who}: ${count} new messages`,
  };
}

/**
 * Call this right after a Sync Together group message is saved.
 * memberIds = all group member user IDs (strings or ObjectIds)
 */
export async function notifyGroupMessage(
  io,
  { groupId, groupName, senderId, senderName, preview, memberIds }
) {
  const recipients = memberIds.filter((id) => String(id) !== String(senderId));

  await Promise.all(
    recipients.map(async (userId) => {
      if (await isViewingGroup(io, groupId, userId)) return; // they're already reading it

      // Collapse into the existing unread notification for this group, if there is one
      let n = await Notification.findOne({
        user: userId,
        type: "group_message",
        group: groupId,
        read: false,
      });

      if (n) {
        n.count += 1;
        n.senders = [
          senderName,
          ...n.senders.filter((s) => s !== senderName),
        ].slice(0, 3);
      } else {
        n = new Notification({
          user: userId,
          type: "group_message",
          group: groupId,
          link: `/sync/${groupId}/chat`,
          senders: [senderName],
          count: 1,
          title: groupName,
        });
      }
      const { title, body } = summarize(n.senders, n.count, groupName);
      n.title = title;
      n.body =
        n.count === 1 && preview
          ? `${senderName}: ${preview.slice(0, 80)}`
          : body;
      await n.save();

      const unread = await Notification.countDocuments({
        user: userId,
        read: false,
      });
      io.to(`user:${userId}`).emit("notification:new", {
        notification: n,
        unread,
      });
    })
  );
}

/** Call when a user opens a group chat, so its bell entry clears. */
export async function markGroupRead(io, userId, groupId) {
  await Notification.updateMany(
    { user: userId, group: groupId, read: false },
    { read: true }
  );
  const unread = await Notification.countDocuments({
    user: userId,
    read: false,
  });
  io.to(`user:${userId}`).emit("notification:unread", { unread });
}
