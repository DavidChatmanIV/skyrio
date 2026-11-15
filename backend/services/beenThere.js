// "Been there": a SkyHub post gets a small check when its author took a trip
// to that place through Skyrio. Only real, finished trips count:
//   - a confirmed flight booking whose trip has started (dates.start in the past)
//   - to an airport within ~40 miles of the post's place (map point), or,
//     when either side has no map point, an airport in the same city by name.
// Nothing here is self-reported, so it can't be faked by typing a city.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Booking from "../models/booking.js";
import { tidyPlace } from "./placeName.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AIRPORTS = new Map(
  JSON.parse(fs.readFileSync(path.join(__dirname, "../airports.json"), "utf8")).map((a) => [a.code, a])
);
const COORDS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/usAirportCoords.json"), "utf8")).airports;

const MILES = 40;
const cityOf = (s) => tidyPlace(s).split(",")[0].trim().toLowerCase();

function miles(aLat, aLng, bLat, bLng) {
  const r = Math.PI / 180;
  const x =
    Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 7917.6 * Math.asin(Math.sqrt(x));
}

/** Where a booking took them: [{ city, lat, lng }] (lat/lng when known). */
export function tripPlaces(b) {
  const out = [];
  const code = String(b?.flight?.destination || "").toUpperCase();
  const ap = AIRPORTS.get(code);
  const pt = COORDS[code];
  const city = cityOf(b?.flight?.destinationName || ap?.city || "");
  if (city || pt) out.push({ city, lat: pt?.[0], lng: pt?.[1] });
  return out;
}

/** Pure: does this post's place match one of these trips? */
export function matchesTrip(post, trips) {
  const [lng, lat] = post?.location?.coordinates || [];
  const postCity = cityOf(post?.destination);
  return trips.some((t) => {
    if (Number.isFinite(lat) && Number.isFinite(t.lat)) return miles(lat, lng, t.lat, t.lng) <= MILES;
    return Boolean(postCity && t.city && postCity === t.city);
  });
}

/** → Set of post ids (strings) whose author has been there. Never throws. */
export async function beenThereIds(posts, { now = new Date(), BookingModel = Booking } = {}) {
  const withPlace = (posts || []).filter((p) => p?.author && p?.destination);
  if (!withPlace.length) return new Set();
  const authors = [...new Set(withPlace.map((p) => String(p.author)))];
  let bookings = [];
  try {
    bookings = await BookingModel.find({
      user: { $in: authors },
      status: "confirmed",
      type: "Flight",
      "dates.start": { $lte: now },
    })
      .select("user flight.destination flight.destinationName")
      .limit(2000)
      .lean();
  } catch {
    return new Set();
  }
  const tripsBy = new Map();
  for (const b of bookings) {
    const k = String(b.user);
    if (!tripsBy.has(k)) tripsBy.set(k, []);
    tripsBy.get(k).push(...tripPlaces(b));
  }
  const ids = new Set();
  for (const p of withPlace) {
    const trips = tripsBy.get(String(p.author));
    if (trips?.length && matchesTrip(p, trips)) ids.add(String(p._id));
  }
  return ids;
}
