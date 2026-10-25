// Where To Next — the deal scan's hotel search.
//
// Lives next to hotels.controller.js and reuses the SAME rates request and
// normalizeHotelRate as the Stays page, so the hotel price on the map is
// calculated exactly like the price a traveler sees when they search.
//
// It picks the cheapest WELL-RATED stay, not the cheapest overall, so the
// map never advertises a bait price for a hotel nobody would book.

import { liteapi } from "./hotel.provider.js";
import { buildOccupancies, normalizeHotelRate } from "./hotels.utils.js";

const MIN_STARS = 3;
const MIN_GUEST_RATING = 7; // out of 10
const HOTELS_TO_PRICE = 25; // best-reviewed hotels we ask prices for

// Hotel lists barely change, so look each city up once per server run.
const hotelListCache = new Map(); // "Miami|US" -> [{ id, name, stars, rating }]

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

async function wellRatedHotels(cityName, countryCode) {
  const key = `${cityName}|${countryCode}`;
  if (hotelListCache.has(key)) return hotelListCache.get(key);

  const result = await liteapi.searchGet("/data/hotels", {
    countryCode,
    cityName,
    limit: 300,
  });
  const all = Array.isArray(result?.data) ? result.data : [];

  const picked = all
    .map((h) => ({
      id: h.id || h.hotelId,
      name: h.name || null,
      stars: num(h.stars ?? h.starRating),
      rating: num(h.rating ?? h.guestRating),
      reviews: num(h.reviewCount) || 0,
    }))
    .filter(
      (h) =>
        h.id &&
        h.name &&
        // Hostel / dorm prices are often a shared bed, not a private room.
        !/hostel|dorm|capsule|bunk/i.test(h.name) &&
        h.stars != null &&
        h.stars >= MIN_STARS &&
        h.rating != null &&
        h.rating <= 10 &&
        h.rating >= MIN_GUEST_RATING
    )
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, HOTELS_TO_PRICE);

  // One line per city, so it's clear why a city has no hotel price.
  console.log(
    `[DealScan] hotels ${cityName}: ${all.length} listed, ${picked.length} passed ${MIN_STARS}+ stars / ${MIN_GUEST_RATING}+ rating` +
      (all.length && !picked.length
        ? ` (fields on first hotel: ${Object.keys(all[0]).join(", ")})`
        : "")
  );

  hotelListCache.set(key, picked);
  return picked;
}

// Taxes/fees LiteAPI marks as NOT included — paid at the hotel (resort
// fees, city tax). Shown separately so the total is never understated.
function payAtHotelOf(offer) {
  let total = 0;
  for (const rate of offer?.raw?.rates || []) {
    for (const t of rate?.retailRate?.taxesAndFees || []) {
      if (t?.included === false) total += num(t.amount) || 0;
    }
  }
  return Math.round(total);
}

/**
 * Cheapest well-rated stay: 1 adult, 1 room.
 * Returns { hotelId, hotelName, stars, rating, price, payAtHotel, currency }
 * or null if nothing came back.
 */
export async function searchCheapestStay({
  cityName,
  countryCode,
  checkin,
  checkout,
}) {
  const hotels = await wellRatedHotels(cityName, countryCode);
  if (!hotels.length) return null;
  const byId = new Map(hotels.map((h) => [h.id, h]));

  const result = await liteapi.searchRequest("/hotels/rates?rm=true", {
    method: "POST",
    body: {
      hotelIds: hotels.map((h) => h.id),
      occupancies: buildOccupancies(1, 1),
      guestNationality: "US",
      currency: "USD",
      checkin,
      checkout,
      roomMapping: true,
      maxRatesPerHotel: 5,
    },
  });

  const offers = (result?.data ?? []).flatMap(normalizeHotelRate);

  let best = null;
  for (const o of offers) {
    const price = num(o.totalAmount);
    const hotel = byId.get(o.hotelId);
    if (!hotel || price == null || price <= 0) continue;
    if (!best || price < best.price) {
      best = {
        hotelId: o.hotelId,
        hotelName: hotel.name,
        stars: hotel.stars,
        rating: hotel.rating,
        price,
        payAtHotel: payAtHotelOf(o),
        currency: o.totalCurrency || "USD",
      };
    }
  }
  return best;
}
