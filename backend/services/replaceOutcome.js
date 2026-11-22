// After an hourly retry of "cancel the old booking" finishes, tell the
// traveler how it ended. Cancelled: the normal cancellation email already
// went out. Kept (no longer free / not allowed): they now hold two bookings
// and were told we'd finish it, so they must hear about it.
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { sendReplaceKeptEmail } from "./bookingEmails.js";

export async function tellReplaceOutcome(newBooking, result) {
  if (!result || !["fee", "not_allowed"].includes(result.status)) return;
  const isFlight = newBooking.type === "Flight";
  const thing = isFlight ? "ticket" : "booking";
  console.error(
    `[price drop] RECONCILE — old ${thing} ${newBooking.replaces?.bookingId} kept after retry (${result.status}); traveler has two bookings`
  );
  let to = newBooking.email;
  if (!to && newBooking.user) {
    const u = await User.findById(newBooking.user).select("email").lean().catch(() => null);
    to = u?.email;
  }
  await sendReplaceKeptEmail({
    to,
    name: String(newBooking.name || "").split(" ")[0],
    type: newBooking.type,
    oldBookingId: newBooking.replaces?.bookingId,
    newBookingId: newBooking._id,
  }).catch(() => {});
  if (newBooking.user) {
    await Notification.create({
      user: newBooking.user,
      type: "booking",
      title: `Your old ${thing} is still active`,
      message: `We couldn't cancel your old ${thing} for free, so you have two bookings. Open it to see your options.`,
      link: `/manage-booking/${newBooking.replaces?.bookingId}`,
    }).catch(() => {});
  }
}
