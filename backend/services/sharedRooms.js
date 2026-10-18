// backend/services/sharedRooms.js
// ─────────────────────────────────────────────────────────────
// Sync Together — shared hotel rooms.
//
// The rule: plan together, pay separately. A shared room is the one
// thing several people pay for together, so it works like this:
//
//   1. The organizer picks a room at checkout and chooses who shares it.
//      Skyrio checks the price with the hotel and splits it evenly.
//   2. Each person puts a HOLD on their own card for their share
//      (Stripe authorize-only — held, not charged).
//   3. When the last hold is in, Skyrio books the room once and charges
//      each hold. If the hotel's price came in lower, everyone pays less.
//   4. If the deadline (48h by default) passes first, or the organizer
//      releases the room, every hold is released. Nobody is charged.
//   5. Only the organizer can cancel a booked shared room. Each person
//      is refunded their share of whatever the hotel refunds.
//
// Everyone gets their own My Trips record for their share.
// ─────────────────────────────────────────────────────────────

import Stripe from "stripe";
import mongoose from "mongoose";
import SplitPayment from "../models/SplitPayment.js";
import SyncGroup from "../models/SyncGroup.js";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { liteapi } from "../routes/api/hotels/hotel.provider.js";
import { hotelGetBooking, hotelCancel, pickAmount } from "./liteapiBookings.js";
import {
  sendShareRequested,
  sendSharedRoomBooked,
  sendSharedRoomReleased,
  sendSharedRoomCancelled,
  sendShareDeadlineReminder,
} from "./syncEmails.js";
import {
  recordEmailResult,
  onGroupBookingSaved,
} from "./bookingConfirmations.js";

let _stripe;
const stripe = () => {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not set");
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
};

export const HOLD_HOURS = Math.max(
  1,
  Number(process.env.SHARED_ROOM_HOLD_HOURS) || 48
);
export const SHARE_KIND = "shared_room_share"; // Stripe metadata.kind
const ACTIVE = ["collecting", "booking", "booked"];

export class SyncError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

const idStr = (v) => (v == null ? null : String(v._id || v));
const sameId = (a, b) => a != null && b != null && idStr(a) === idStr(b);

// ── Live updates (socket.io room "group:<id>", same as the rest of Sync Together) ──
let _io = null;
export function setSyncIo(io) {
  if (io) _io = io;
}
function emitGroup(groupId, payload = {}) {
  try {
    _io
      ?.to(`group:${groupId}`)
      .emit("sync:update", { groupId: String(groupId), ...payload });
  } catch {
    /* live updates are best-effort */
  }
}

// ─────────────────────────────────────────────────────────────
// Who's on the trip
// ─────────────────────────────────────────────────────────────
export function organizerId(group) {
  return idStr(group.tripComposition?.organizerId) || idStr(group.owner);
}
export function isOrganizer(group, userId) {
  return sameId(group.owner, userId) || sameId(organizerId(group), userId);
}
export function isGroupMember(group, userId) {
  if (sameId(group.owner, userId)) return true;
  return (group.members || []).some((m) => m.user && sameId(m.user, userId));
}

// Owner first, then every member who hasn't declined.
export function travelersOf(group) {
  const owner = group.owner || {};
  const list = [
    {
      memberId: null,
      userId: idStr(owner),
      name: owner.name || owner.username || "Organizer",
      email: owner.email || null,
      isOrganizer: true,
      rsvp: "accepted",
      hasAccount: true,
      lastRemindedAt: null,
    },
  ];
  for (const m of group.members || []) {
    if (m.status === "declined") continue;
    list.push({
      rsvp: m.status || "pending",
      memberId: idStr(m._id),
      userId: m.user ? idStr(m.user) : null,
      name: m.user?.name || m.user?.username || m.name || m.email || "Traveler",
      email: m.email || m.user?.email || null,
      isOrganizer: false,
      hasAccount: Boolean(m.user),
      lastRemindedAt: m.lastRemindedAt || null,
    });
  }
  return list;
}

// ─────────────────────────────────────────────────────────────
// LiteAPI helpers
// ─────────────────────────────────────────────────────────────
function readPrebookPrice(prebookResult) {
  const d = prebookResult?.data ?? prebookResult ?? {};
  for (const c of [d.totalPrice, d.price, d.suggestedSellingPrice]) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

async function prebook(offerId) {
  const r = await liteapi.bookRequest("/rates/prebook", {
    method: "POST",
    body: { usePaymentSdk: false, offerId },
  });
  const prebookId = r?.data?.prebookId ?? r?.prebookId;
  const price = readPrebookPrice(r);
  const currency = String(
    r?.data?.currency ?? r?.currency ?? "USD"
  ).toLowerCase();
  if (!prebookId || !Number.isFinite(price)) {
    throw new SyncError(502, "The hotel didn't return a price for this room.");
  }
  return { prebookId, cents: Math.round(price * 100), currency };
}

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

// The offer from the original search may have expired by the time
// everyone has paid. Search the same hotel again and find the same room.
async function requoteSameRoom(room) {
  const result = await liteapi.searchRequest("/hotels/rates?rm=true", {
    method: "POST",
    body: {
      hotelIds: [room.hotelId],
      occupancies: [{ adults: Math.max(1, Number(room.adults) || 1) }],
      guestNationality: "US",
      currency: "USD",
      checkin: room.checkin,
      checkout: room.checkout,
      roomMapping: true,
      maxRatesPerHotel: 30,
    },
  });
  const hotel =
    (result?.data || []).find(
      (h) => String(h.hotelId) === String(room.hotelId)
    ) || result?.data?.[0];
  const candidates = [];
  for (const rt of hotel?.roomTypes || []) {
    const rate = rt?.rates?.[0] || {};
    if (norm(rate.name) !== norm(room.roomName)) continue;
    if (room.boardName && norm(rate.boardName) !== norm(room.boardName))
      continue;
    const amount = Number(
      rt?.offerRetailRate?.amount ?? rate?.retailRate?.total?.[0]?.amount
    );
    if (rt.offerId && Number.isFinite(amount))
      candidates.push({ offerId: rt.offerId, amount });
  }
  candidates.sort((a, b) => a.amount - b.amount);
  return candidates[0] || null;
}

function splitName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// Even split in cents; leftover cents go to the first people listed
// (the organizer is listed first).
export function evenSplit(totalCents, count) {
  const base = Math.floor(totalCents / count);
  let extra = totalCents - base * count;
  return Array.from({ length: count }, () => base + (extra-- > 0 ? 1 : 0));
}

// Scale each share to a new total, keeping the sum exact.
export function scaleShares(amounts, newTotal) {
  const oldTotal = amounts.reduce((a, b) => a + b, 0) || 1;
  const scaled = amounts.map((a) => Math.floor((a * newTotal) / oldTotal));
  let left = newTotal - scaled.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % scaled.length, left--) scaled[i] += 1;
  return scaled;
}

function summarizeHotelPolicy(data, paid) {
  const cp = data?.cancellationPolicies || {};
  const infos = Array.isArray(cp.cancelPolicyInfos) ? cp.cancelPolicyInfos : [];
  const now = Date.now();
  const passed = infos
    .filter((p) => p?.cancelTime && new Date(p.cancelTime).getTime() <= now)
    .sort((a, b) => new Date(b.cancelTime) - new Date(a.cancelTime));
  const fee = passed.length ? Number(passed[0].amount) || 0 : 0;
  const nonRefundable = cp.refundableTag === "NRFN";
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    refundableTag: cp.refundableTag || null,
    policies: infos.map((p) => ({
      after: p.cancelTime,
      fee: Number(p.amount) || 0,
      currency: p.currency || data?.currency || "USD",
    })),
    estimatedFee: nonRefundable && !infos.length ? paid : Math.min(fee, paid),
    estimatedRefund:
      nonRefundable && !infos.length ? 0 : Math.max(0, r2(paid - fee)),
  };
}

// ─────────────────────────────────────────────────────────────
// What the trip page shows for a shared room
// ─────────────────────────────────────────────────────────────
export function sharedRoomForClient(split, viewerId) {
  return {
    id: String(split._id),
    status: split.status,
    deadline: split.deadline,
    room: split.room,
    totalCents: split.totalCents,
    currency: split.currency,
    people: split.shares.length,
    createdBy: idStr(split.createdBy),
    closedReason: split.closedReason || null,
    hotelConfirmationCode: split.supplier?.hotelConfirmationCode || null,
    bookedCents: split.supplier?.bookedCents ?? null,
    shares: split.shares.map((s) => ({
      id: String(s._id),
      memberId: idStr(s.member),
      userId: idStr(s.user),
      name: s.name,
      amountOwed: s.amountOwed,
      capturedCents: s.capturedCents || 0,
      refundedCents: s.refundedCents || 0,
      status: s.status,
      isYou: sameId(s.user, viewerId),
      bookingId: idStr(s.booking),
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// 1. Organizer sets up a shared room
// ─────────────────────────────────────────────────────────────
export async function createSharedRoom({
  group,
  actorUserId,
  room,
  userIds,
  holder,
}) {
  if (!isOrganizer(group, actorUserId)) {
    throw new SyncError(
      403,
      "Only the trip organizer can set up a shared room."
    );
  }
  if (group.status === "cancelled")
    throw new SyncError(400, "This trip was cancelled.");
  if (!room?.offerId || !room?.hotelId || !room?.checkin || !room?.checkout) {
    throw new SyncError(400, "Pick a room from the hotel search first.");
  }
  const holderName = {
    firstName: String(holder?.firstName || "").trim(),
    lastName: String(holder?.lastName || "").trim(),
  };
  const holderEmail = String(holder?.email || "")
    .trim()
    .toLowerCase();
  if (
    !holderName.firstName ||
    !holderName.lastName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail)
  ) {
    throw new SyncError(
      400,
      "Enter the guest's first and last name and a contact email."
    );
  }

  const travelers = travelersOf(group);
  const wanted = [...new Set((userIds || []).map(String))];
  const people = travelers.filter((t) => t.userId && wanted.includes(t.userId));
  if (people.length !== wanted.length) {
    throw new SyncError(
      400,
      "Everyone sharing the room must be on this trip and have a Skyrio account."
    );
  }
  if (people.length < 2)
    throw new SyncError(400, "Pick at least 2 people to share the room.");

  const adults = Number(room.adults);
  if (!Number.isFinite(adults) || adults < 1) {
    throw new SyncError(
      400,
      "Search hotels again so we know how many guests this room is for."
    );
  }
  if (people.length > adults) {
    throw new SyncError(
      400,
      `This room was priced for ${adults} guest${
        adults === 1 ? "" : "s"
      }. Search again with ${
        people.length
      } guests so the hotel prices it for everyone.`
    );
  }

  // One shared room per person at a time on this trip.
  const busy = await SplitPayment.find({
    group: group._id,
    kind: "shared_room",
    status: { $in: ACTIVE },
    "shares.user": { $in: people.map((p) => p.userId) },
  }).lean();
  if (busy.length) {
    const taken = new Set(
      busy.flatMap((b) => b.shares.map((s) => String(s.user)))
    );
    const names = people.filter((p) => taken.has(p.userId)).map((p) => p.name);
    throw new SyncError(
      409,
      `${names.join(", ")} already ${
        names.length === 1 ? "has" : "have"
      } a shared room on this trip.`
    );
  }

  // Check the price with the hotel now so nobody holds the wrong amount.
  let quote;
  try {
    quote = await prebook(room.offerId);
  } catch (e) {
    throw new SyncError(
      502,
      "We couldn't confirm this room's price with the hotel. Search again and pick the room again.",
      { details: e?.message }
    );
  }

  // Organizer first so any leftover cent lands on them.
  people.sort((a, b) =>
    a.userId === String(actorUserId)
      ? -1
      : b.userId === String(actorUserId)
      ? 1
      : 0
  );
  const amounts = evenSplit(quote.cents, people.length);
  const accounts = await User.find({
    _id: { $in: people.map((p) => p.userId) },
  })
    .select("name username email")
    .lean();
  const byId = Object.fromEntries(accounts.map((u) => [String(u._id), u]));

  const split = await SplitPayment.create({
    kind: "shared_room",
    group: group._id,
    createdBy: actorUserId,
    status: "collecting",
    deadline: new Date(Date.now() + HOLD_HOURS * 3600 * 1000),
    room: {
      hotelId: room.hotelId,
      offerId: room.offerId,
      name: room.name,
      roomName: room.roomName,
      boardName: room.boardName,
      address: room.address,
      thumbnail: room.thumbnail,
      checkin: String(room.checkin).slice(0, 10),
      checkout: String(room.checkout).slice(0, 10),
      adults,
    },
    holder: { ...holderName, email: holderEmail },
    totalCents: quote.cents,
    currency: quote.currency,
    supplier: { prebookId: quote.prebookId },
    shares: people.map((p, i) => ({
      member: p.memberId,
      user: p.userId,
      name: byId[p.userId]?.name || byId[p.userId]?.username || p.name,
      email: byId[p.userId]?.email || p.email,
      amountOwed: amounts[i],
      currency: quote.currency,
    })),
  });

  await SyncGroup.updateOne(
    { _id: group._id },
    {
      $push: {
        activityLog: {
          type: "shared_room_created",
          user: actorUserId,
          message: `Set up a shared room at ${room.name || "the hotel"} for ${
            people.length
          } people`,
          createdAt: new Date(),
        },
      },
    }
  );

  const organizer = byId[String(actorUserId)];
  for (const s of split.shares) {
    if (sameId(s.user, actorUserId)) continue;
    sendShareRequested({
      to: s.email,
      name: s.name,
      organizerName: organizer?.name || organizer?.username,
      room: split.room,
      shareCents: s.amountOwed,
      currency: split.currency,
      people: split.shares.length,
      deadline: split.deadline,
      groupId: group._id,
    });
    Notification.create({
      user: s.user,
      type: "booking",
      title: "Hold your share of the room 🛏️",
      message: `You're sharing a room at ${
        split.room.name || "the hotel"
      }. Hold your share before the deadline.`,
      link: `/sync-together/${group._id}`,
    }).catch(() => {});
  }

  emitGroup(group._id, { sharedRoomId: String(split._id) });
  return split;
}

// ─────────────────────────────────────────────────────────────
// 2. A person holds their share
// ─────────────────────────────────────────────────────────────
async function loadShare(splitId, shareId, userId) {
  if (
    !mongoose.isValidObjectId(splitId) ||
    !mongoose.isValidObjectId(shareId)
  ) {
    throw new SyncError(400, "Invalid shared room.");
  }
  const split = await SplitPayment.findOne({
    _id: splitId,
    kind: "shared_room",
  });
  if (!split) throw new SyncError(404, "Shared room not found.");
  const share = split.shares.id(shareId);
  if (!share) throw new SyncError(404, "Share not found.");
  if (userId && !sameId(share.user, userId)) {
    throw new SyncError(403, "This share belongs to someone else.");
  }
  return { split, share };
}

// Stripe says "No such payment_intent" when an id belongs to another
// account (keys changed) or was deleted. Treat that as "no hold yet".
async function retrieveIntentOrNull(id) {
  try {
    return await stripe().paymentIntents.retrieve(id);
  } catch (e) {
    if (e?.code === "resource_missing" || e?.statusCode === 404) {
      console.warn(
        "[shared-room] saved PaymentIntent not found — starting a new hold",
        id
      );
      return null;
    }
    throw e;
  }
}

export async function startShareHold({ splitId, shareId, userId }) {
  let { split, share } = await loadShare(splitId, shareId, userId);
  if (
    split.status === "collecting" &&
    split.deadline &&
    split.deadline <= new Date()
  ) {
    await releaseSharedRoom(split._id, "expired");
    throw new SyncError(
      410,
      "The deadline for this room has passed, so it was released."
    );
  }
  if (split.status !== "collecting") {
    throw new SyncError(409, "This room is no longer collecting holds.");
  }
  if (share.status === "authorized" || share.status === "paid") {
    return { alreadyHeld: true };
  }

  // Reuse an open PaymentIntent so retries don't create extra holds.
  // If the saved hold can't be found (e.g. it was made with a different
  // Stripe account/keys), forget it and start a fresh one below.
  const existing = share.stripePaymentIntentId
    ? await retrieveIntentOrNull(share.stripePaymentIntentId)
    : null;
  if (existing) {
    const pi = existing;
    if (pi.status === "requires_capture") {
      await markShareAuthorized({
        splitId: split._id,
        shareId: share._id,
        paymentIntentId: pi.id,
      });
      return { alreadyHeld: true };
    }
    if (
      [
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
      ].includes(pi.status) &&
      pi.amount === share.amountOwed
    ) {
      return {
        clientSecret: pi.client_secret,
        amount: share.amountOwed,
        currency: split.currency,
      };
    }
    if (pi.status !== "canceled") {
      await stripe()
        .paymentIntents.cancel(pi.id)
        .catch(() => {});
    }
  }

  const pi = await stripe().paymentIntents.create({
    amount: share.amountOwed,
    currency: split.currency,
    capture_method: "manual", // HOLD only — charged when everyone is in
    payment_method_types: ["card"],
    receipt_email: share.email || undefined,
    description: `Shared room share — ${split.room?.name || "hotel"}`,
    metadata: {
      kind: SHARE_KIND,
      splitPaymentId: String(split._id),
      shareId: String(share._id),
      groupId: String(split.group),
      userId: String(share.user),
    },
  });
  await SplitPayment.updateOne(
    { _id: split._id, "shares._id": share._id },
    {
      $set: {
        "shares.$.stripePaymentIntentId": pi.id,
        "shares.$.status": "unpaid",
        "shares.$.lastError": null,
      },
    }
  );
  return {
    clientSecret: pi.client_secret,
    amount: share.amountOwed,
    currency: split.currency,
  };
}

// Called by the trip page right after the card is confirmed, and by the
// Stripe webhook (payment_intent.amount_capturable_updated). Whichever
// runs first records it.
export async function confirmShareHold({ splitId, shareId, userId }) {
  const { share } = await loadShare(splitId, shareId, userId);
  if (share.status === "authorized" || share.status === "paid")
    return { held: true };
  if (!share.stripePaymentIntentId)
    throw new SyncError(400, "No card hold was started.");
  const pi = await retrieveIntentOrNull(share.stripePaymentIntentId);
  if (!pi)
    throw new SyncError(
      409,
      "Your card hold couldn't be found. Please hold your share again."
    );
  if (pi.status !== "requires_capture") {
    throw new SyncError(
      402,
      "Your card hasn't been authorized yet. Please try again."
    );
  }
  await markShareAuthorized({ splitId, shareId, paymentIntentId: pi.id });
  return { held: true };
}

export async function markShareAuthorized({
  splitId,
  shareId,
  paymentIntentId,
}) {
  const r = await SplitPayment.updateOne(
    {
      _id: splitId,
      status: "collecting",
      shares: {
        $elemMatch: { _id: shareId, status: { $in: ["unpaid", "failed"] } },
      },
    },
    {
      $set: {
        "shares.$.status": "authorized",
        "shares.$.authorizedAt": new Date(),
        "shares.$.stripePaymentIntentId": paymentIntentId,
        "shares.$.lastError": null,
      },
    }
  );
  if (!r.modifiedCount) {
    // The room closed while this card was being authorized — let the hold go.
    const split = await SplitPayment.findById(splitId).lean();
    if (
      split &&
      split.status !== "collecting" &&
      split.status !== "booking" &&
      split.status !== "booked"
    ) {
      await stripe()
        .paymentIntents.cancel(paymentIntentId)
        .catch(() => {});
    }
    return { changed: false };
  }
  const split = await SplitPayment.findById(splitId).lean();

  // Show it in the trip's Activity so everyone sees who's in.
  const held = (split.shares || []).find((x) => sameId(x._id, shareId));
  const heldCount = (split.shares || []).filter(
    (x) => x.status === "authorized" || x.status === "paid"
  ).length;
  if (held) {
    await SyncGroup.updateOne(
      { _id: split.group },
      {
        $push: {
          activityLog: {
            type: "shared_room_held",
            user: held.user,
            message: `Held their share of ${
              split.room?.name || "the shared room"
            } (${heldCount} of ${split.shares.length} in)`,
            createdAt: new Date(),
          },
        },
      }
    ).catch((e) =>
      console.error(
        "[shared-room] activity log failed",
        String(splitId),
        e?.message
      )
    );
  }

  emitGroup(split.group, { sharedRoomId: String(splitId) });
  // Last one in? Book it.
  finalizeSharedRoom(splitId).catch((e) =>
    console.error("[shared-room] finalize error", String(splitId), e?.message)
  );
  return { changed: true };
}

export async function markShareFailed({ splitId, shareId, message }) {
  await SplitPayment.updateOne(
    {
      _id: splitId,
      shares: { $elemMatch: { _id: shareId, status: "unpaid" } },
    },
    {
      $set: {
        "shares.$.status": "failed",
        "shares.$.lastError": message || "Card declined",
      },
    }
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Everyone's in → book the room once, charge every hold
// ─────────────────────────────────────────────────────────────
export async function finalizeSharedRoom(splitId) {
  // Lock: only one caller moves collecting → booking, and only when every
  // share is held.
  const split = await SplitPayment.findOneAndUpdate(
    {
      _id: splitId,
      status: "collecting",
      shares: {
        $not: { $elemMatch: { status: { $nin: ["authorized", "paid"] } } },
      },
    },
    { $set: { status: "booking" } },
    { new: true }
  );
  if (!split) return { finalized: false };

  // Double-check every hold with Stripe before booking anything.
  for (const s of split.shares) {
    let ok = false;
    try {
      const pi = await stripe().paymentIntents.retrieve(
        s.stripePaymentIntentId
      );
      ok =
        pi.status === "requires_capture" &&
        pi.amount_capturable >= s.amountOwed;
    } catch {
      ok = false;
    }
    if (!ok) {
      s.status = "unpaid";
      s.lastError =
        "Your card hold expired or was released. Please hold your share again.";
      split.status = "collecting";
      await split.save();
      emitGroup(split.group, { sharedRoomId: String(split._id) });
      return { finalized: false, reason: "hold_missing" };
    }
  }

  // Get a bookable price: the original offer first, then the same room
  // from a fresh search if that offer has expired.
  let quote = null;
  try {
    quote = await prebook(split.room.offerId);
  } catch {
    try {
      const again = await requoteSameRoom(split.room);
      if (again) quote = await prebook(again.offerId);
    } catch (e) {
      console.error(
        "[shared-room] requote failed",
        String(split._id),
        e?.message
      );
    }
  }
  if (!quote)
    return releaseSharedRoom(split._id, "sold_out", { fromStatus: "booking" });
  if (quote.cents > split.totalCents) {
    console.warn(
      "[shared-room] price rose",
      String(split._id),
      split.totalCents,
      "→",
      quote.cents
    );
    return releaseSharedRoom(split._id, "price_changed", {
      fromStatus: "booking",
    });
  }

  // Book it.
  const holder = split.holder?.firstName ? split.holder : null;
  const fallback = splitName(split.shares[0]?.name) || {
    firstName: split.shares[0]?.name || "Guest",
    lastName: "Guest",
  };
  const h = holder
    ? {
        firstName: holder.firstName,
        lastName: holder.lastName,
        email: holder.email,
      }
    : { ...fallback, email: split.shares[0]?.email };
  let booked;
  try {
    const result = await liteapi.bookRequest("/rates/book", {
      method: "POST",
      body: {
        holder: h,
        guests: [
          {
            occupancyNumber: 1,
            firstName: h.firstName,
            lastName: h.lastName,
            email: h.email,
          },
        ],
        payment: { method: "ACC_CREDIT_CARD" },
        prebookId: quote.prebookId,
      },
    });
    booked = result?.data ?? result ?? {};
  } catch (e) {
    console.error(
      "[shared-room] LiteAPI book failed",
      String(split._id),
      e?.message
    );
    return releaseSharedRoom(split._id, "failed", { fromStatus: "booking" });
  }
  if (!booked.bookingId) {
    console.error(
      "[shared-room] LiteAPI returned no bookingId — check by hand",
      String(split._id),
      booked
    );
  }

  // Charge each hold — everyone pays less if the hotel price dropped.
  const charges = scaleShares(
    split.shares.map((s) => s.amountOwed),
    quote.cents
  );
  const currencyUpper = String(split.currency || "usd").toUpperCase();
  const tripDetails = [
    split.room.name || "Hotel stay",
    `${split.room.checkin} → ${split.room.checkout}`,
    `shared room (${split.shares.length} people)`,
  ].join(" · ");

  for (let i = 0; i < split.shares.length; i++) {
    const s = split.shares[i];
    const amount = charges[i];
    try {
      await stripe().paymentIntents.capture(
        s.stripePaymentIntentId,
        amount < s.amountOwed ? { amount_to_capture: amount } : {},
        { idempotencyKey: `shared_capture_${split._id}_${s._id}` }
      );
      s.status = "paid";
      s.paidAt = new Date();
      s.capturedCents = amount;
    } catch (e) {
      // The room IS booked; this person's charge didn't go through.
      console.error(
        "[shared-room] RECONCILE — room booked but capture failed",
        String(split._id),
        String(s._id),
        e?.message
      );
      s.status = "failed";
      s.lastError =
        "Room booked, but this card couldn't be charged. Skyrio support will follow up.";
    }

    try {
      const rec = await Booking.create({
        user: s.user,
        name: s.name,
        email: s.email,
        tripDetails,
        type: "Hotel",
        dates: {
          start: new Date(`${split.room.checkin}T12:00:00Z`),
          end: new Date(`${split.room.checkout}T12:00:00Z`),
        },
        travelers: 1,
        passengers: [{ name: s.name, type: "adult" }],
        status: s.status === "paid" ? "confirmed" : "pending",
        paidAt: s.status === "paid" ? new Date() : null,
        total: (s.capturedCents || 0) / 100,
        totalAmount: (s.capturedCents || 0) / 100,
        totalCurrency: currencyUpper,
        paymentIntentId: s.stripePaymentIntentId,
        stripePaymentIntentId: s.stripePaymentIntentId,
        provider: "liteapi",
        providerBookingIds: booked.bookingId ? [String(booked.bookingId)] : [],
        confirmationCodes: booked.hotelConfirmationCode
          ? [String(booked.hotelConfirmationCode)]
          : [],
        hotelStay: {
          rooms: [
            {
              ...JSON.parse(JSON.stringify(split.room)),
              totalAmount: (s.capturedCents || 0) / 100,
              totalCurrency: currencyUpper,
            },
          ],
          confirmation: [
            {
              prebookId: quote.prebookId,
              bookingId: booked.bookingId || null,
              hotelConfirmationCode: booked.hotelConfirmationCode || null,
            },
          ],
        },
        syncGroup: split.group,
        sharedRoom: {
          splitPaymentId: String(split._id),
          groupId: String(split.group),
          shareId: String(s._id),
          people: split.shares.length,
          roomTotal: quote.cents / 100,
          shareAmount: (s.capturedCents || 0) / 100,
        },
      });
      s.booking = rec._id;
    } catch (e) {
      console.error(
        "[shared-room] couldn't save My Trips record (room IS booked)",
        String(split._id),
        String(s._id),
        e?.message
      );
    }
  }

  split.status = "booked";
  split.supplier = {
    prebookId: quote.prebookId,
    bookingId: booked.bookingId ? String(booked.bookingId) : null,
    hotelConfirmationCode: booked.hotelConfirmationCode
      ? String(booked.hotelConfirmationCode)
      : null,
    bookedCents: quote.cents,
    bookedAt: new Date(),
  };
  await split.save();

  await SyncGroup.updateOne(
    { _id: split.group },
    {
      $push: {
        activityLog: {
          type: "shared_room_booked",
          user: null,
          message: `Everyone held their share — ${
            split.room.name || "the shared room"
          } is booked`,
          createdAt: new Date(),
        },
      },
    }
  );

  for (const s of split.shares) {
    if (s.status !== "paid") continue;
    User.findByIdAndUpdate(s.user, { $inc: { xp: 200 } }).catch(() => {});
    Notification.create({
      user: s.user,
      type: "booking",
      title: "Shared room booked 🏨",
      message: `Everyone's in — ${split.room.name || "your room"} is booked.`,
      link: "/saved-trips",
    }).catch(() => {});
    const sent = sendSharedRoomBooked({
      to: s.email,
      name: s.name,
      room: split.room,
      shareCents: s.capturedCents,
      currency: split.currency,
      people: split.shares.length,
      confirmationCode:
        split.supplier.hotelConfirmationCode || split.supplier.bookingId,
      bookingId: s.booking,
    });
    if (s.booking) {
      sent
        .then((r) => recordEmailResult(s.booking, s.email, r))
        .catch(() => {});
    }
  }
  // One group update for the whole room (checks "everyone's booked").
  const firstRecord = split.shares.find((s) => s.booking)?.booking;
  if (firstRecord) {
    Booking.findById(firstRecord)
      .then((b) => b && onGroupBookingSaved(b))
      .catch(() => {});
  }

  emitGroup(split.group, { sharedRoomId: String(split._id), booked: true });
  return { finalized: true, split };
}

// ─────────────────────────────────────────────────────────────
// 4. Release every hold — nobody is charged
// ─────────────────────────────────────────────────────────────
export async function releaseSharedRoom(
  splitId,
  reason = "released",
  { fromStatus = "collecting", notify = true } = {}
) {
  const closed = ["expired", "released", "member_left"].includes(reason)
    ? reason === "expired"
      ? "expired"
      : "released"
    : "failed";
  const split = await SplitPayment.findOneAndUpdate(
    { _id: splitId, status: fromStatus },
    { $set: { status: closed, closedReason: reason } },
    { new: true }
  );
  if (!split) return { released: false };

  for (const s of split.shares) {
    if (s.stripePaymentIntentId && s.status !== "paid") {
      try {
        const pi = await stripe().paymentIntents.retrieve(
          s.stripePaymentIntentId
        );
        if (!["canceled", "succeeded"].includes(pi.status)) {
          await stripe().paymentIntents.cancel(s.stripePaymentIntentId);
        }
      } catch (e) {
        console.error(
          "[shared-room] couldn't release hold — check Stripe",
          s.stripePaymentIntentId,
          e?.message
        );
      }
    }
    if (s.status !== "paid") s.status = "released";
  }
  await split.save();

  await SyncGroup.updateOne(
    { _id: split.group },
    {
      $push: {
        activityLog: {
          type: "shared_room_released",
          user: null,
          message: `Shared room at ${
            split.room?.name || "the hotel"
          } released — nobody was charged`,
          createdAt: new Date(),
        },
      },
    }
  );

  if (notify) {
    for (const s of split.shares) {
      sendSharedRoomReleased({
        to: s.email,
        name: s.name,
        room: split.room,
        reason,
        groupId: split.group,
      });
      Notification.create({
        user: s.user,
        type: "booking",
        title: "Shared room released",
        message: `The shared room at ${
          split.room?.name || "the hotel"
        } was released. You weren't charged.`,
        link: `/sync-together/${split.group}`,
      }).catch(() => {});
    }
  }
  emitGroup(split.group, { sharedRoomId: String(split._id) });
  return { released: true, reason, split };
}

export async function expireDueSharedRooms(filter = {}) {
  const due = await SplitPayment.find({
    kind: "shared_room",
    status: "collecting",
    deadline: { $lte: new Date() },
    ...filter,
  })
    .select("_id")
    .lean();
  for (const d of due) {
    await releaseSharedRoom(d._id, "expired").catch((e) =>
      console.error("[shared-room] expire failed", String(d._id), e?.message)
    );
  }
  // A room stuck mid-booking for 15+ minutes needs a person to look.
  const stuck = await SplitPayment.find({
    kind: "shared_room",
    status: "booking",
    updatedAt: { $lte: new Date(Date.now() - 15 * 60 * 1000) },
    ...filter,
  })
    .select("_id group")
    .lean();
  for (const s of stuck)
    console.error(
      "[shared-room] RECONCILE — stuck in 'booking'",
      String(s._id)
    );
  return { expired: due.length };
}

// ─────────────────────────────────────────────────────────────
// Automatic reminders: 24 hours and 6 hours before a room releases, email
// everyone who hasn't held their share yet. Each mark is sent once per
// person, and a mark is skipped if the room was set up after it (so a
// short hold window doesn't send a reminder right after the invite).
// ─────────────────────────────────────────────────────────────
const REMINDER_MARKS = [
  { key: "6h", ms: 6 * 3600 * 1000 },
  { key: "24h", ms: 24 * 3600 * 1000 },
];

export async function sendDeadlineReminders(filter = {}) {
  const now = Date.now();
  const rooms = await SplitPayment.find({
    kind: "shared_room",
    status: "collecting",
    deadline: { $gt: new Date(now), $lte: new Date(now + 24 * 3600 * 1000) },
    ...filter,
  });
  let sent = 0;
  for (const room of rooms) {
    const msLeft = room.deadline.getTime() - now;
    const mark = REMINDER_MARKS.find((m) => msLeft <= m.ms); // smallest mark reached
    if (!mark) continue;
    const markAt = room.deadline.getTime() - mark.ms;
    if (room.createdAt && room.createdAt.getTime() > markAt) continue;

    const heldCount = room.shares.filter(
      (s) => s.status === "authorized" || s.status === "paid"
    ).length;
    for (const s of room.shares) {
      if (!["unpaid", "failed"].includes(s.status)) continue;
      if ((s.remindersSent || []).includes(mark.key)) continue;
      // Claim the mark first so two job runs can't both send it.
      const claimed = await SplitPayment.updateOne(
        {
          _id: room._id,
          shares: {
            $elemMatch: { _id: s._id, remindersSent: { $ne: mark.key } },
          },
        },
        { $addToSet: { "shares.$.remindersSent": mark.key } }
      );
      if (!claimed.modifiedCount) continue;
      sent++;
      sendShareDeadlineReminder({
        to: s.email,
        name: s.name,
        room: room.room,
        shareCents: s.amountOwed,
        currency: room.currency,
        deadline: room.deadline,
        groupId: room.group,
        heldCount,
        people: room.shares.length,
        hoursLeft: Math.max(1, Math.round(msLeft / 3600000)),
      });
      Notification.create({
        user: s.user,
        type: "booking",
        title:
          mark.key === "6h"
            ? "Last call for the shared room ⏳"
            : "Hold your share of the room",
        message: `${heldCount} of ${
          room.shares.length
        } have held their share of ${
          room.room?.name || "the room"
        }. It's released if everyone isn't in by the deadline.`,
        link: `/sync-together/${room.group}`,
      }).catch(() => {});
    }
  }
  return { sent };
}

// Members leaving or being removed: release any room still collecting.
export async function releaseRoomsForUser(groupId, userId) {
  const open = await SplitPayment.find({
    group: groupId,
    kind: "shared_room",
    status: "collecting",
    "shares.user": userId,
  })
    .select("_id")
    .lean();
  for (const o of open) await releaseSharedRoom(o._id, "member_left");
  return open.length;
}

// ─────────────────────────────────────────────────────────────
// 5. Organizer cancels a booked shared room
// ─────────────────────────────────────────────────────────────
export async function sharedRoomCancelQuote(split) {
  if (split.status !== "booked")
    throw new SyncError(409, "Only a booked room can be cancelled.");
  const paid =
    split.shares.reduce((a, s) => a + (s.capturedCents || 0), 0) / 100;
  let summary = {
    estimatedRefund: null,
    estimatedFee: null,
    policies: [],
    refundableTag: null,
  };
  if (split.supplier?.bookingId) {
    try {
      const { data } = await hotelGetBooking(split.supplier.bookingId);
      summary = summarizeHotelPolicy(data, paid);
    } catch (e) {
      console.error(
        "[shared-room] cancel quote failed",
        String(split._id),
        e?.message
      );
      throw new SyncError(
        502,
        "We couldn't get the hotel's cancellation terms right now. Try again, or contact support."
      );
    }
  }
  const perPerson =
    summary.estimatedRefund != null
      ? scaleShares(
          split.shares.map((s) => s.capturedCents || 0),
          Math.round(summary.estimatedRefund * 100)
        )
      : null;
  return {
    paid,
    currency: String(split.currency || "usd").toUpperCase(),
    ...summary,
    perPerson: perPerson
      ? split.shares.map((s, i) => ({
          shareId: String(s._id),
          name: s.name,
          refundCents: perPerson[i],
        }))
      : null,
  };
}

export async function cancelSharedRoom({ split, actorUserId, actorName }) {
  const locked = await SplitPayment.findOneAndUpdate(
    { _id: split._id, status: "booked" },
    { $set: { status: "cancelled", closedReason: "cancelled" } },
    { new: true }
  );
  if (!locked)
    throw new SyncError(
      409,
      "This room is already cancelled or not booked yet."
    );

  let supplierData = {};
  if (locked.supplier?.bookingId) {
    try {
      const r = await hotelCancel(locked.supplier.bookingId);
      supplierData = r.data || {};
    } catch (e) {
      if (/already\s+cancel/i.test(e.message || "")) {
        const live = await hotelGetBooking(locked.supplier.bookingId).catch(
          () => null
        );
        supplierData = live?.data || {};
      } else {
        locked.status = "booked";
        locked.closedReason = null;
        await locked.save();
        console.error(
          "[shared-room] hotel refused cancellation",
          String(locked._id),
          e?.message
        );
        throw new SyncError(
          502,
          "The hotel didn't accept the cancellation. Nothing was changed. Try again or contact support."
        );
      }
    }
  }

  const captured = locked.shares.map((s) => s.capturedCents || 0);
  const paidCents = captured.reduce((a, b) => a + b, 0);
  const supplierRefund =
    pickAmount(supplierData, ["refund_amount", "refundAmount", "refund"]) || 0;
  const fee =
    pickAmount(supplierData, [
      "cancellation_fee",
      "cancellationFee",
      "penalty",
    ]) || 0;
  const refundTotal = Math.min(Math.round(supplierRefund * 100), paidCents);
  const refunds =
    refundTotal > 0
      ? scaleShares(captured, refundTotal)
      : captured.map(() => 0);
  const currencyUpper = String(locked.currency || "usd").toUpperCase();

  for (let i = 0; i < locked.shares.length; i++) {
    const s = locked.shares[i];
    const cents = Math.min(refunds[i], s.capturedCents || 0);
    let refundStatus = "none";
    let stripeRefundId = null;
    let refundError = null;
    if (cents > 0 && s.stripePaymentIntentId) {
      try {
        const refund = await stripe().refunds.create(
          {
            payment_intent: s.stripePaymentIntentId,
            amount: cents,
            metadata: {
              splitPaymentId: String(locked._id),
              shareId: String(s._id),
              reason: "shared_room_cancelled",
            },
          },
          { idempotencyKey: `shared_refund_${locked._id}_${s._id}` }
        );
        stripeRefundId = refund.id;
        refundStatus = refund.status === "succeeded" ? "succeeded" : "pending";
        s.refundedCents = cents;
        s.status = "refunded";
      } catch (e) {
        refundError = e.message;
        refundStatus = "failed";
        console.error(
          "[shared-room] RECONCILE — room cancelled but refund failed",
          String(locked._id),
          String(s._id),
          e?.message
        );
      }
    }
    if (s.booking) {
      await Booking.updateOne(
        { _id: s.booking },
        {
          $set: {
            status: "cancelled",
            refundStatus,
            refundAmount: cents ? cents / 100 : null,
            ...(refundStatus === "succeeded" ? { refundedAt: new Date() } : {}),
            cancellation: {
              at: new Date(),
              by: "organizer",
              byUserId: String(actorUserId),
              supplier: [
                {
                  bookingId: locked.supplier?.bookingId,
                  ok: true,
                  data: supplierData,
                },
              ],
              supplierRefund,
              cancellationFee: fee,
              customerRefund: cents / 100,
              currency: currencyUpper,
              stripeRefundId,
              refundError,
              sharedRoom: true,
            },
          },
        }
      ).catch((e) =>
        console.error(
          "[shared-room] booking record update failed",
          String(s.booking),
          e?.message
        )
      );
    }
    sendSharedRoomCancelled({
      to: s.email,
      name: s.name,
      room: locked.room,
      refundCents: cents,
      currency: locked.currency,
      organizerName: actorName,
    });
    Notification.create({
      user: s.user,
      type: "booking",
      title: "Shared room cancelled",
      message: `${actorName || "The organizer"} cancelled the shared room at ${
        locked.room?.name || "the hotel"
      }.`,
      link: "/saved-trips",
    }).catch(() => {});
  }

  locked.cancellation = {
    at: new Date(),
    byUserId: String(actorUserId),
    supplierRefund,
    cancellationFee: fee,
    refundedCents: refunds.reduce((a, b) => a + b, 0),
    supplier: supplierData,
  };
  locked.markModified("cancellation");
  await locked.save();

  await SyncGroup.updateOne(
    { _id: locked.group },
    {
      $push: {
        activityLog: {
          type: "shared_room_cancelled",
          user: actorUserId,
          message: `Cancelled the shared room at ${
            locked.room?.name || "the hotel"
          }`,
          createdAt: new Date(),
        },
      },
    }
  );
  emitGroup(locked.group, { sharedRoomId: String(locked._id) });
  return {
    refundedCents: refunds.reduce((a, b) => a + b, 0),
    currency: currencyUpper,
    perPerson: locked.shares.map((s, i) => ({
      name: s.name,
      refundCents: refunds[i],
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Background job: release holds whose deadline has passed.
// Started once when syncTogether.routes.js loads.
// ─────────────────────────────────────────────────────────────
let _timer = null;
export function startSharedRoomJobs({ everyMs = 10 * 60 * 1000 } = {}) {
  if (_timer) return;
  const tick = async () => {
    if (mongoose.connection.readyState !== 1) return;
    await expireDueSharedRooms().catch((e) =>
      console.error("[shared-room] expire job error", e?.message)
    );
    await sendDeadlineReminders().catch((e) =>
      console.error("[shared-room] reminder job error", e?.message)
    );
  };
  _timer = setInterval(tick, everyMs);
  _timer.unref?.();
  setTimeout(tick, 30 * 1000).unref?.();
}

// ─────────────────────────────────────────────────────────────
// Tag a solo booking with its Sync Together trip — only if the traveler
// is actually on that trip. Returns the group id or null.
// ─────────────────────────────────────────────────────────────
export async function memberGroupId(groupId, userId) {
  if (!groupId || !userId || !mongoose.isValidObjectId(groupId)) return null;
  const found = await SyncGroup.exists({
    _id: groupId,
    $or: [{ owner: userId }, { "members.user": userId }],
  }).catch(() => null);
  return found ? String(found._id) : null;
}
