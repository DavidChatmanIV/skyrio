// Price Watch on a booking: is Skyrio watching it for a lower price, and if
// not, why — in plain words for Manage booking. Nothing here promises a
// saving; it says exactly when the traveler would hear from us.
import { stayCanBeWatched } from "./stayPriceDrop.js";
import { flightCanBeWatched } from "./flightPriceDrop.js";

const DAY = 24 * 3600 * 1000;

export function priceWatchStatus(b, now = Date.now()) {
  if (!b || b.status !== "confirmed") return null;
  if (b.type === "Hotel") {
    if (stayCanBeWatched(b, now))
      return {
        on: true,
        text: "We check this room's price every day. If the same room gets cheaper while you can still cancel for free, we'll tell you. Non-refundable rates can't use a lower price.",
      };
    if (b.sharedRoom || b.syncGroup) return { on: false, text: "Shared Sync Together rooms aren't watched." };
    return null; // past, or a booking we can't check: say nothing
  }
  if (b.type === "Flight") {
    if (flightCanBeWatched(b, now))
      return {
        on: true,
        text: "We check these exact flights a few times a day. If they get cheaper while the airline would still refund your ticket in full, we'll tell you.",
      };
    const dep = Date.parse(b.flight?.departureAt || b.dates?.start || "");
    if (!Number.isFinite(dep) || dep <= now) return null;
    if (b.syncGroup || b.flight?.groupId) return { on: false, text: "Sync Together flights aren't watched." };
    if (!b.flight?.journeyKey || !b.flight?.search)
      return { on: false, text: "This flight was booked before Price Watch covered booked flights." };
    if (Number(b.flight?.extrasAmount) > 0)
      return { on: false, text: "Off for this booking: paid seats or bags may not be refunded, so switching might not save you money." };
    if (dep - now <= 3 * DAY) return { on: false, text: "Price Watch stops 3 days before departure." };
    return null;
  }
  return null;
}
