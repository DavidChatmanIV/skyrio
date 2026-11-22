// Two days before check-in, reminds hotel guests about money the HOTEL
// collects itself (cash deposit, resort fee…), so nobody is surprised at
// the desk. Only for stays whose hotel listed such a charge. Each booking
// is reminded once (hotelStay.chargesReminderSentAt).

import Booking from "../models/booking.js";
import { sendHotelChargesReminder } from "../services/bookingEmails.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// The stay's charge details: the booking's own copy first, then the
// details saved from checkout.
function chargesOf(booking) {
  const hs = booking.hotelStay || {};
  const stays = [
    ...(hs.confirmation || []).map((c) => c?.stay),
    ...(hs.rooms || []).map((r) => r?.stayInfo),
  ].filter(Boolean);
  return (
    stays.find((s) => s.deposit || (s.otherCharges || []).length) ||
    stays.find((s) => (s.hotelCharges || []).length) ||
    null
  );
}

export async function runHotelChargesReminderOnce(now = new Date()) {
  // Check-in between 36 and 60 hours from now ≈ "in two days", whatever
  // hour the job runs.
  const from = new Date(now.getTime() + 1.5 * DAY_MS);
  const to = new Date(now.getTime() + 2.5 * DAY_MS);
  const due = await Booking.find({
    type: "Hotel",
    status: "confirmed",
    "dates.start": { $gte: from, $lte: to },
    "hotelStay.chargesReminderSentAt": { $exists: false },
  })
    .select("_id email name dates hotelStay")
    .limit(500)
    .lean();

  let sent = 0;
  let skipped = 0;
  for (const b of due) {
    const stay = chargesOf(b);
    // Claim it first so two servers never send the same reminder twice.
    const claimed = await Booking.updateOne(
      { _id: b._id, "hotelStay.chargesReminderSentAt": { $exists: false } },
      { $set: { "hotelStay.chargesReminderSentAt": new Date() } }
    );
    if (!claimed.modifiedCount) continue;
    if (!stay) {
      skipped++;
      continue;
    }
    const room = b.hotelStay?.rooms?.[0] || {};
    try {
      await sendHotelChargesReminder({
        to: b.email,
        guestName: String(b.name || "").split(" ")[0],
        hotelName: room.name,
        checkin: room.checkin || b.dates?.start,
        stay,
        bookingId: String(b._id),
      });
      sent++;
    } catch (e) {
      console.error("[chargesReminder] email failed", String(b._id), e?.message);
    }
  }
  return { checked: due.length, sent, skipped };
}
