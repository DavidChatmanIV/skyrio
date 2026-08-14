// ─────────────────────────────────────────────────────────────
// hotels.utils.js
// Shared helpers for the hotels API layer — mirrors flights.utils.js
// ─────────────────────────────────────────────────────────────

/**
 * Validate a date string is in YYYY-MM-DD format.
 * @param {string} date
 * @returns {boolean}
 */
export function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Build the occupancies array LiteAPI expects for a search.
 *
 * @param {number} adults
 * @param {number} [rooms=1]
 * @returns {Array}
 */
export function buildOccupancies(adults = 1, rooms = 1) {
  return [{ adults: Number(adults), rooms: Number(rooms) }];
}

/**
 * Normalize LiteAPI's real /hotels/rates response into a flat
 * list the frontend can render — one entry per room type/offer.
 *
 * Confirmed against a real production response:
 * {
 *   data: [
 *     {
 *       hotelId, et,
 *       roomTypes: [
 *         {
 *           roomTypeId, offerId, supplier, supplierId,
 *           rates: [{ rateId, name, boardName, retailRate, cancellationPolicies, ... }],
 *           offerRetailRate: { amount, currency },
 *           rateType, paymentTypes
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * @param {object} hotelEntry  One entry from result.data
 * @returns {object[]} Flattened list of bookable offers for this hotel
 */
export function normalizeHotelRate(hotelEntry) {
  const hotelId = hotelEntry.hotelId;
  const roomTypes = hotelEntry.roomTypes ?? [];

  return roomTypes.map((roomType) => {
    const firstRate = roomType.rates?.[0] ?? {};

    return {
      hotelId,
      roomTypeId: roomType.roomTypeId,
      offerId: roomType.offerId,

      roomName: firstRate.name ?? "Unknown room",
      boardName: firstRate.boardName ?? "",
      refundableTag: firstRate.cancellationPolicies?.refundableTag ?? null,

      totalAmount: roomType.offerRetailRate?.amount ?? null,
      totalCurrency: roomType.offerRetailRate?.currency ?? "USD",
      suggestedSellingPrice: roomType.suggestedSellingPrice?.amount ?? null,

      rateType: roomType.rateType ?? "standard",
      supplier: roomType.supplier ?? "",

      raw: roomType,
    };
  });
}
