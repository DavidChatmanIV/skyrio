// backend/providers/liteapi/hotels.js
// Thin adapter so Atlas can search and prebook hotels with the same
// LiteAPI client the regular hotel checkout uses (routes/api/hotels).
//
// Atlas only knows a city name, but /hotels/rates needs hotelIds, so a
// search is: /data/places (name → placeId, billed per call) →
// /data/hotels (placeId → hotels) → /hotels/rates.

import { liteapi } from "../../routes/api/hotels/hotel.provider.js";
import { buildOccupancies, normalizeHotelRate } from "../../routes/api/hotels/hotels.utils.js";

const MAX_HOTELS = 30;

function nightsBetween(checkin, checkout) {
  const ms = new Date(`${checkout}T00:00:00Z`) - new Date(`${checkin}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86400000));
}

function cancellationTextOf(roomType) {
  const policy = roomType?.rates?.[0]?.cancellationPolicies;
  if (policy?.refundableTag !== "RFN") return "Non-refundable";
  const deadline = policy?.cancelPolicyInfos?.[0]?.cancelTime;
  return deadline ? `Free cancellation until ${deadline}` : "Refundable (see policy)";
}

/**
 * @param {{destination, checkin, checkout, adults, rooms?}} input
 * @returns {Promise<object[]>} rates in Atlas shape, cheapest first
 */
export async function searchHotelRates({ destination, checkin, checkout, adults = 1, rooms = 1 }) {
  const places = await liteapi.searchGet("/data/places", { textQuery: destination });
  const placeId = (places?.data ?? [])[0]?.placeId;
  if (!placeId) return [];

  const hotelsRes = await liteapi.searchGet("/data/hotels", { placeId, limit: MAX_HOTELS });
  const hotels = hotelsRes?.data ?? [];
  if (!hotels.length) return [];
  const byId = new Map(hotels.map((h) => [h.id, h]));

  const ratesRes = await liteapi.searchRequest("/hotels/rates?rm=true", {
    method: "POST",
    body: {
      hotelIds: hotels.map((h) => h.id),
      occupancies: buildOccupancies(adults, rooms),
      guestNationality: "US",
      currency: "USD",
      checkin,
      checkout,
      roomMapping: true,
      maxRatesPerHotel: 3,
    },
  });

  const nights = nightsBetween(checkin, checkout);
  return (ratesRes?.data ?? [])
    .flatMap(normalizeHotelRate)
    .filter((r) => r.offerId && Number.isFinite(Number(r.totalAmount)))
    .map((r) => {
      const hotel = byId.get(r.hotelId) || {};
      const total = Number(r.totalAmount);
      const { raw: _raw, ...rate } = r;
      return {
        offerId: r.offerId,
        hotelId: r.hotelId,
        hotelName: hotel.name || "Hotel",
        starRating: hotel.stars ?? null,
        roomName: r.roomName,
        boardName: r.boardName,
        total,
        nightly: Math.round((total / nights) * 100) / 100,
        currency: r.totalCurrency || "USD",
        refundableTag: r.refundableTag,
        cancellationText: cancellationTextOf(r.raw),
        // Room object in the shape <HotelCheckout rooms={[...]}> reads, so an
        // Atlas "Review & pay" link opens the normal hotel checkout on it.
        frontend: {
          ...rate,
          name: hotel.name || "Hotel",
          address: hotel.address || "",
          thumbnail: hotel.thumbnail || hotel.main_photo || null,
          checkin,
          checkout,
          adults,
          totalAmount: total,
          totalCurrency: r.totalCurrency || "USD",
        },
      };
    })
    .sort((a, b) => a.total - b.total);
}

function firstNumber(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

// Same prebook call as the regular checkout (usePaymentSdk: false — Skyrio
// charges the card through Stripe, then books with LiteAPI).
export async function createHotelPrebook({ offerId }) {
  const res = await liteapi.bookRequest("/rates/prebook", {
    method: "POST",
    body: { usePaymentSdk: false, offerId },
  });
  const d = res?.data ?? res ?? {};
  const prebookId = d.prebookId;
  const total = firstNumber(d.totalPrice, d.price, d.suggestedSellingPrice);
  if (!prebookId || !Number.isFinite(total)) {
    const err = new Error("Hotel prebook response missing prebookId or price");
    err.details = res;
    throw err;
  }
  return {
    prebookId,
    price: { total, currency: d.currency || "USD" },
    cancellationText: null, // Atlas falls back to the search result's text
    raw: res,
  };
}
