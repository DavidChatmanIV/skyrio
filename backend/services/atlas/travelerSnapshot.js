// A few facts Atlas can use to skip questions and tell a first-timer from
// a seasoned traveler: home airport, travel interests, and how many Skyrio
// trips they've already taken. One small read per chat; never throws.
import User from "../../models/user.js";
import Booking from "../../models/booking.js";

/** Pure: the facts → the lines Atlas reads ("" when there's nothing). */
export function snapshotText({ homeAirport, vibes = [], pastTrips = 0 } = {}) {
  const lines = [];
  if (homeAirport?.code) {
    lines.push(`- Home airport: ${homeAirport.city ? `${homeAirport.city} (${homeAirport.code})` : homeAirport.code}`);
  }
  if (vibes.length) lines.push(`- Interests: ${vibes.slice(0, 5).join(", ")}`);
  lines.push(
    pastTrips > 0
      ? `- Past Skyrio trips: ${pastTrips >= 10 ? "10+" : pastTrips} (treat as experienced unless they seem unsure)`
      : "- Past Skyrio trips: none yet"
  );
  return `TRAVELER SNAPSHOT (from their account; don't ask what this already answers):\n${lines.join("\n")}`;
}

export async function travelerSnapshot(userId, { UserModel = User, BookingModel = Booking, now = new Date() } = {}) {
  if (!userId) return "";
  try {
    const [u, pastTrips] = await Promise.all([
      UserModel.findById(userId).select("homeAirport travelVibes").lean(),
      BookingModel.countDocuments({ user: userId, status: "confirmed", "dates.start": { $lte: now } }).catch(() => 0),
    ]);
    if (!u) return "";
    return snapshotText({ homeAirport: u.homeAirport, vibes: u.travelVibes || [], pastTrips: Math.min(pastTrips, 10) });
  } catch {
    return "";
  }
}
