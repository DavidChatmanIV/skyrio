// src/utils/venueDistance.js
// Sort hotel results by distance to the event venue ("Closest to the stadium").
//
// const sorted = sortByDistanceToVenue(hotels, event.venue, (h) => ({ lat: h.latitude, lng: h.longitude }));
// Then show `hotel.distanceToVenueMiles` on the card, e.g. "0.4 mi from Madison Square Garden".

export function distanceMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sortByDistanceToVenue(items, venue, getLatLng) {
  return items
    .map((item) => {
      const miles = distanceMiles(getLatLng(item), venue);
      return { ...item, distanceToVenueMiles: miles == null ? null : Math.round(miles * 10) / 10 };
    })
    .sort((a, b) => {
      if (a.distanceToVenueMiles == null) return 1;
      if (b.distanceToVenueMiles == null) return -1;
      return a.distanceToVenueMiles - b.distanceToVenueMiles;
    });
}
