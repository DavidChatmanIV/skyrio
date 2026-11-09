// backend/routes/api/cars/cars.service.js
// Car search used by BOTH the Cars tab (GET /api/cars/search) and Atlas
// (search_cars tool). One shared cache, so a car Atlas finds has the same
// rate id when the Cars tab opens on it a moment later.
import { duffelFlights as duffel } from "../flights/Duffelflights.provider.js";
import { normalizeCarOffer, rentalDays } from "./cars.utils.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEARCH_RADIUS = 10;
const CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map();
const placeCache = new Map();

export function carsEnabled() {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN);
}

export class CarSearchError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const duffelCode = (err) => err?.response?.data?.errors?.[0]?.code || "";

// Airport code / city text → coordinates (Duffel Places).
export async function resolveLocation(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const key = q.toUpperCase();
  if (placeCache.has(key)) return placeCache.get(key);
  const { data } = await duffel.get("/places/suggestions", { params: { query: q }, timeout: 15000 });
  const list = data?.data || [];
  const isCode = /^[A-Za-z]{3}$/.test(q);
  const pick =
    (isCode && list.find((p) => p.type === "airport" && p.iata_code === key)) ||
    list.find((p) => p.type === "airport" && p.latitude != null) ||
    (list.find((p) => p.type === "city")?.airports || []).find((a) => a.latitude != null) ||
    null;
  const place =
    pick && pick.latitude != null
      ? {
          lat: Number(pick.latitude),
          lng: Number(pick.longitude),
          name: pick.name,
          code: pick.iata_code || null,
          city: pick.city_name || pick.city?.name || null,
        }
      : null;
  if (place) placeCache.set(key, place);
  return place;
}

/**
 * Search postpaid car rentals.
 * @returns {{ place, days, cars, liveMode }}  (throws CarSearchError)
 */
export async function searchCars({
  location,
  pickupDate,
  pickupTime = "10:00",
  dropoffDate,
  dropoffTime = "10:00",
  driverAge = 30,
}) {
  if (!carsEnabled()) throw new CarSearchError("Car rentals aren't available right now.", 503);
  if (!location) throw new CarSearchError("Enter a pick-up airport or city.");
  if (!DATE_RE.test(pickupDate || "") || !DATE_RE.test(dropoffDate || "")) {
    throw new CarSearchError("Pick your pick-up and drop-off dates.");
  }
  if (!TIME_RE.test(pickupTime) || !TIME_RE.test(dropoffTime)) {
    throw new CarSearchError("Times must look like 10:30.");
  }
  const pickupAt = Date.parse(`${pickupDate}T${pickupTime}:00Z`);
  const dropoffAt = Date.parse(`${dropoffDate}T${dropoffTime}:00Z`);
  if (!(dropoffAt > pickupAt)) throw new CarSearchError("Drop-off must be after pick-up.");
  if (pickupDate < new Date().toISOString().slice(0, 10)) {
    throw new CarSearchError("Pick-up can't be in the past.");
  }
  const age = Number(driverAge);
  if (!Number.isInteger(age) || age < 18 || age > 99) {
    throw new CarSearchError("Enter the driver's age (18 or older).");
  }

  let place;
  try {
    place = await resolveLocation(location);
  } catch (err) {
    console.error("[cars/search] place lookup failed:", duffelCode(err) || err.message);
    throw new CarSearchError("Car rental companies didn't respond. Please try again in a moment.", 502);
  }
  if (!place) throw new CarSearchError("We couldn't find that location. Try an airport code like MIA.", 404);

  const cacheKey = [place.lat, place.lng, pickupDate, pickupTime, dropoffDate, dropoffTime, age].join("|");
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.body;

  const coords = { latitude: place.lat, longitude: place.lng };
  let data;
  try {
    ({ data } = await duffel.post(
      "/cars/search",
      {
        data: {
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          dropoff_date: dropoffDate,
          dropoff_time: dropoffTime,
          pickup_location: { radius: SEARCH_RADIUS, geographic_coordinates: coords },
          dropoff_location: { radius: SEARCH_RADIUS, geographic_coordinates: coords },
          driver: { age, residence_country_code: "US" },
        },
      },
      { timeout: 45000 }
    ));
  } catch (err) {
    console.error("[cars/search] failed:", duffelCode(err) || err.message);
    throw new CarSearchError("Car rental companies didn't respond. Please try again in a moment.", 502);
  }

  const days = rentalDays(pickupDate, pickupTime, dropoffDate, dropoffTime);
  const rates = data?.data?.rates || [];
  // Only "pay at pickup" rates: prepaid/guarantee need a card step that isn't built.
  const postpaid = rates.filter((r) => r.payment_type === "postpaid");
  if (postpaid.length < rates.length) {
    console.info(`[cars/search] hid ${rates.length - postpaid.length} prepaid/guarantee rate(s) (card step not built)`);
  }
  const cars = postpaid
    .map((r) => normalizeCarOffer(r, days))
    .filter((c) => c.totalAmount > 0)
    .sort((a, b) => a.totalAmount - b.totalAmount);

  const body = { ok: true, place, days, cars, liveMode: data?.data?.live_mode ?? null };
  searchCache.set(cacheKey, { ts: Date.now(), body });
  if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value);
  console.log(`[cars/search] ${place.code || place.name}: ${cars.length} car(s)`);
  return body;
}
