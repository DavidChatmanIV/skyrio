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
 * FIXED: LiteAPI's `occupancies` is an array with ONE ENTRY PER ROOM —
 * each entry describes that single room's adults (and optionally
 * children). There is no "rooms" field on an occupancy object; the
 * room count is simply how many objects are in the array. The
 * previous version of this function returned a single object like
 * `[{ adults, rooms }]`, which isn't a shape LiteAPI recognizes for
 * multi-room requests — it was silently being treated as one room
 * regardless of what "rooms" the user asked for, which is why
 * multi-room searches never actually returned multi-room pricing.
 *
 * This splits the requested total travelers as evenly as possible
 * across the requested number of rooms (e.g. 7 adults / 3 rooms →
 * [3, 2, 2]). Every room gets at least 1 adult.
 *
 * @param {number} adults - total travelers across all rooms
 * @param {number} [rooms=1] - number of rooms requested
 * @returns {Array<{adults: number}>}
 */
export function buildOccupancies(adults = 1, rooms = 1) {
  const roomCount = Math.max(1, Math.round(Number(rooms)) || 1);
  const totalAdults = Math.max(1, Math.round(Number(adults)) || 1);

  const base = Math.floor(totalAdults / roomCount);
  const extra = totalAdults % roomCount;

  const occupancies = [];
  for (let i = 0; i < roomCount; i++) {
    // Distribute the remainder across the first `extra` rooms so the
    // split is as even as possible, e.g. 7 adults / 3 rooms → 3,2,2.
    const roomAdults = base + (i < extra ? 1 : 0);
    occupancies.push({ adults: Math.max(1, roomAdults) });
  }
  return occupancies;
}

/**
 * Normalize LiteAPI's real /hotels/rates response into a flat
 * list the frontend can render — one entry per bookable OFFER.
 *
 * IMPORTANT: an "offer" is not always one room. When a search
 * requests multiple occupancies (multiple rooms), LiteAPI bundles
 * all of them into a SINGLE offerId — prebooking/booking that one
 * offerId books every room in the bundle together in one call. The
 * previous version of this function only kept `rates[0]`, silently
 * discarding every other room in a multi-room offer — that's why a
 * 3-room search still showed (and would have booked) only 1 room.
 *
 * This now keeps every rate in `rates`, and callers should treat
 * `rates.length` as the true room count for this offer.
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
    const rates = roomType.rates ?? [];
    const firstRate = rates[0] ?? {};

    return {
      hotelId,
      roomTypeId: roomType.roomTypeId,
      offerId: roomType.offerId,

      // Primary display fields still reflect the first rate, so
      // existing single-room cards/UI keep working unchanged.
      roomName: firstRate.name ?? "Unknown room",
      boardName: firstRate.boardName ?? "",
      refundableTag: firstRate.cancellationPolicies?.refundableTag ?? null,

      // NEW: the full set of rates in this offer — one per room when
      // this offer bundles multiple rooms (multi-occupancy search).
      // rates.length is the true room count for this offer; every
      // entry has its own `name` (room type) and `boardName`, which
      // can differ between rooms in the same bundled offer.
      rates: rates.map((r) => ({
        rateId: r.rateId,
        name: r.name ?? "Unknown room",
        boardName: r.boardName ?? "",
        refundableTag: r.cancellationPolicies?.refundableTag ?? null,
      })),
      roomCount: rates.length || 1,

      // offerRetailRate is the TOTAL for the whole offer (all bundled
      // rooms combined), not per-room — this was already correct even
      // before this fix.
      totalAmount: roomType.offerRetailRate?.amount ?? null,
      totalCurrency: roomType.offerRetailRate?.currency ?? "USD",
      suggestedSellingPrice: roomType.suggestedSellingPrice?.amount ?? null,

      rateType: roomType.rateType ?? "standard",
      supplier: roomType.supplier ?? "",

      raw: roomType,
    };
  });
}
