import Booking from "../models/booking.js";
import { awardXpForBooking } from "./xpService.js";

// Moves guest bookings (booked without an account) made with this email
// onto the account, and awards the booking XP they didn't get as guests.
//
// ONLY call this once the account's email is VERIFIED. Otherwise anyone
// could sign up with someone else's email and take over their trips.
//
// Safe to call more than once: already-claimed bookings are skipped, and
// the XP ledger pays each booking once.
export async function claimGuestBookings(user) {
  const email = String(user?.email || "")
    .trim()
    .toLowerCase();
  if (!user?._id || !email) return 0;

  const guestBookings = await Booking.find({ user: null, email }).select(
    "_id status"
  );
  if (!guestBookings.length) return 0;

  await Booking.updateMany(
    { _id: { $in: guestBookings.map((b) => b._id) }, user: null },
    { $set: { user: user._id, claimedAt: new Date() } }
  );

  for (const b of guestBookings) {
    if (b.status === "confirmed") {
      await awardXpForBooking(b._id).catch((e) =>
        console.error("[claim] XP failed:", String(b._id), e?.message)
      );
    }
  }

  console.log(
    `[claim] moved ${guestBookings.length} guest booking(s) to user`,
    String(user._id)
  );
  return guestBookings.length;
}
