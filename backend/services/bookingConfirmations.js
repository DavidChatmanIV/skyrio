// backend/services/bookingConfirmations.js
// ─────────────────────────────────────────────────────────────
// Makes sure every traveler gets a confirmation email, and records
// whether it went out so the trip page can show it (and offer Resend).
//
//   recordEmailResult(bookingId, to, result) — save how a send went
//   sendConfirmationFor(booking)             — (re)build and send the
//                                              right email from the
//                                              saved Booking record
//   onGroupBookingSaved(booking)             — tell the rest of the
//                                              Sync Together group, and
//                                              send "everyone's booked"
//                                              once the whole group is in
// ─────────────────────────────────────────────────────────────

import Booking from "../models/booking.js";
import User from "../models/user.js";
import SyncGroup from "../models/SyncGroup.js";
import SplitPayment from "../models/SplitPayment.js";
import Notification from "../models/notification.js";
import { sendBookingConfirmation } from "./email.js";
import { sendHotelConfirmation } from "./bookingEmails.js";
import { sendSharedRoomBooked, sendEveryoneBooked } from "./syncEmails.js";

// ── Save the outcome of a confirmation email on the booking ──
export async function recordEmailResult(bookingId, to, result) {
  if (!bookingId) return;
  const ok = Boolean(result?.ok);
  try {
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          confirmationEmail: {
            status: ok ? "sent" : "failed",
            to: to || null,
            at: new Date(),
            error: ok ? null : String(result?.error?.message || result?.error || "send failed").slice(0, 200),
          },
        },
        $inc: { "confirmationEmailAttempts": 1 },
      }
    );
  } catch (e) {
    console.error("[confirmations] couldn't record email result", String(bookingId), e?.message);
  }
}

async function emailFor(booking) {
  if (booking.email) return booking.email;
  const u = await User.findById(booking.user).select("email").lean().catch(() => null);
  return u?.email || null;
}

// ── Build and send the right confirmation from the saved record ──
export async function sendConfirmationFor(booking) {
  const b = booking?.toObject ? booking.toObject() : booking;
  if (!b) return { ok: false, error: "no booking" };
  const to = await emailFor(b);
  if (!to) {
    await recordEmailResult(b._id, null, { ok: false, error: "no email address on file" });
    return { ok: false, error: "no email address on file" };
  }
  const currency = b.totalCurrency || "USD";
  let result;

  if (b.type === "Flight") {
    const f = b.flight || {};
    result = await sendBookingConfirmation({
      to,
      passengerName: b.name || b.passengers?.[0]?.name,
      confirmationNumber: f.bookingRef || f.bookingId || b.confirmationCodes?.[0] || String(b._id),
      confirmationIsAirline: Boolean(f.bookingRef),
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      originName: f.originName,
      destinationName: f.destinationName,
      departureAt: f.departureAt,
      arrivalAt: f.arrivalAt,
      returnDepartureAt: f.returnDepartureAt,
      returnArrivalAt: f.returnArrivingAt,
      totalAmount: b.totalAmount ?? b.total,
      currency,
    }).catch((e) => ({ ok: false, error: e?.message }));
  } else if (b.type === "Hotel" && b.sharedRoom) {
    const room = b.hotelStay?.rooms?.[0] || {};
    result = await sendSharedRoomBooked({
      to,
      name: (b.name || "").split(" ")[0],
      room,
      shareCents: Math.round((b.totalAmount ?? b.total ?? 0) * 100),
      currency,
      people: b.sharedRoom.people,
      confirmationCode: b.confirmationCodes?.[0] || b.providerBookingIds?.[0],
      bookingId: String(b._id),
    }).catch((e) => ({ ok: false, error: e?.message }));
  } else if (b.type === "Hotel") {
    const conf = b.hotelStay?.confirmation || [];
    const rooms = (b.hotelStay?.rooms || []).map((r, i) => ({
      ...r,
      guestName: b.passengers?.[i]?.name || b.name,
      confirmationCode: conf[i]?.hotelConfirmationCode || conf[i]?.bookingId || null,
    }));
    result = await sendHotelConfirmation({
      to,
      guestName: (b.name || "").split(" ")[0],
      rooms,
      totalAmount: b.totalAmount ?? b.total,
      currency,
      bookingId: String(b._id),
    }).catch((e) => ({ ok: false, error: e?.message }));
  } else {
    result = { ok: false, error: `no confirmation email for ${b.type} bookings` };
  }

  await recordEmailResult(b._id, to, result);
  return result || { ok: false };
}

// ─────────────────────────────────────────────────────────────
// Sync Together: someone in the group just booked their part.
// ─────────────────────────────────────────────────────────────
export async function onGroupBookingSaved(booking) {
  try {
    const groupId = booking?.syncGroup;
    if (!groupId) return;
    const group = await SyncGroup.findById(groupId)
      .populate("owner", "name username email")
      .populate("members.user", "name username email");
    if (!group) return;

    const booker =
      String(group.owner?._id) === String(booking.user)
        ? group.owner
        : group.members.find((m) => m.user && String(m.user._id) === String(booking.user))?.user;
    const who = booker?.name || booker?.username || "Someone";
    const what = booking.type === "Flight" ? "their flight" : booking.sharedRoom ? "their share of the room" : "their room";

    // 1. Let everyone else on the trip know (in-app).
    const others = [
      group.owner?._id,
      ...group.members.filter((m) => m.user && m.status !== "declined").map((m) => m.user._id),
    ].filter((id) => id && String(id) !== String(booking.user));
    await Promise.all(
      others.map((id) =>
        Notification.create({
          user: id,
          type: "booking",
          title: `${who} booked ${what} ✈️`,
          message: `${who} booked ${what} for ${group.title || "your trip"}.`,
          link: `/sync-together/${group._id}`,
        }).catch(() => {})
      )
    );
    group.activityLog.push({ type: "booked_part", user: booking.user, message: `${who} booked ${what}`, createdAt: new Date() });

    // 2. Is the whole group booked now? Then tell everyone, once.
    if (!group.allBookedAt) {
      const travelers = [
        { id: group.owner?._id, user: group.owner },
        ...group.members.filter((m) => m.status !== "declined").map((m) => ({ id: m.user?._id || null, user: m.user, email: m.email, name: m.name })),
      ];
      if (travelers.every((t) => t.id)) {
        const ids = travelers.map((t) => t.id);
        const [bookings, rooms] = await Promise.all([
          Booking.find({
            user: { $in: ids },
            status: { $in: ["confirmed", "pending"] },
            $or: [{ syncGroup: group._id }, { "flight.groupId": String(group._id) }],
          })
            .select("user type sharedRoom flight.arrivalAt")
            .lean(),
          SplitPayment.find({ group: group._id, kind: "shared_room", status: "booked" }).select("shares.user").lean(),
        ]);
        const inRoom = new Set(rooms.flatMap((r) => r.shares.map((s) => String(s.user))));
        const done = ids.every((id) => {
          const mine = bookings.filter((b) => String(b.user) === String(id));
          const flight = mine.some((b) => b.type === "Flight");
          const stay = mine.some((b) => b.type === "Hotel") || inRoom.has(String(id));
          return flight && stay;
        });
        if (done) {
          group.allBookedAt = new Date();
          group.activityLog.push({ type: "all_booked", user: null, message: "Everyone's booked!", createdAt: new Date() });
          const arrivals = travelers
            .map((t) => {
              const f = bookings.find((b) => String(b.user) === String(t.id) && b.type === "Flight");
              return { name: t.user?.name || t.user?.username || t.name || "Traveler", arrivesAt: f?.flight?.arrivalAt || null };
            })
            .sort((a, b) => String(a.arrivesAt || "z").localeCompare(String(b.arrivesAt || "z")));
          for (const t of travelers) {
            const to = t.user?.email || t.email;
            sendEveryoneBooked({
              to,
              name: t.user?.name || t.name,
              tripTitle: group.title,
              destination: group.destination,
              arrivals,
              groupId: group._id,
            });
            if (t.id) {
              Notification.create({
                user: t.id,
                type: "booking",
                title: "Everyone's booked 🎉",
                message: `Every traveler on ${group.title || "your trip"} has booked their flight and room.`,
                link: `/sync-together/${group._id}`,
              }).catch(() => {});
            }
          }
        }
      }
    }
    await group.save();
  } catch (e) {
    console.error("[confirmations] group update failed", String(booking?._id), e?.message);
  }
}
