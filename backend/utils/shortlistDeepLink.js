// Sends a shortlist click straight to the exact item someone suggested,
// instead of re-running a generic search.
//
// REQUIREMENT: when "Suggest to group" saves an item, store a `ref` snapshot
// with the IDs below (not just name/price). Example shapes:
//
//   hotel:    { type: "hotel", ref: { hotelId, rateId?, checkin, checkout, rooms, adults } }
//   activity: { type: "activity", ref: { productCode, date? } }          // Viator
//   flight:   { type: "flight", ref: {
//                 origin, destination, departDate, returnDate, cabinClass, adults,
//                 // stable fingerprint — offerIds expire in ~15 min, so never rely on them
//                 carrier, outbound: { flightNumbers: ["NU123"], departAt },
//                 inbound:  { flightNumbers: ["NU456"], departAt } } }

export function shortlistLink(item, trip) {
  const r = item.ref || {};
  const q = (o) =>
    new URLSearchParams(
      Object.fromEntries(
        Object.entries(o).filter(([, v]) => v != null && v !== "")
      )
    ).toString();

  switch (item.type) {
    case "hotel":
      // Opens that hotel's detail page with the group's dates pre-filled
      return `/hotels/${r.hotelId}?${q({
        checkin: r.checkin || trip.startDate?.slice(0, 10),
        checkout: r.checkout || trip.endDate?.slice(0, 10),
        rooms: r.rooms || 1,
        adults: r.adults || 2,
        rateId: r.rateId,
        from: `sync-${trip._id}`,
      })}`;

    case "activity":
      return `/excursions/${r.productCode}?${q({
        date: r.date,
        from: `sync-${trip._id}`,
      })}`;

    case "flight":
      // Flight offers expire, so we re-search with the SAME params and
      // auto-select the matching itinerary (see matchFlightOffer below).
      return `/flights/results?${q({
        origin: r.origin,
        destination: r.destination,
        depart: r.departDate,
        return: r.returnDate,
        cabin: r.cabinClass,
        adults: r.adults || 1,
        match: item._id, // results page reads this and calls matchFlightOffer
        from: `sync-${trip._id}`,
      })}`;

    default:
      return null;
  }
}

// Used on the flight results page when ?match= is present.
// Returns the fresh offer that matches the suggested flight, or null.
export function matchFlightOffer(offers, ref) {
  const key = (legs) => (legs || []).join("|").toUpperCase();
  const sameMinute = (a, b) =>
    a && b && new Date(a).getTime() === new Date(b).getTime();

  return (
    offers.find((o) => {
      const out = o.outbound || o.legs?.[0];
      const inn = o.inbound || o.legs?.[1];
      const outOk =
        key(out?.flightNumbers) === key(ref.outbound?.flightNumbers) &&
        sameMinute(out?.departAt, ref.outbound?.departAt);
      const inOk =
        !ref.inbound ||
        (key(inn?.flightNumbers) === key(ref.inbound?.flightNumbers) &&
          sameMinute(inn?.departAt, ref.inbound?.departAt));
      return outOk && inOk;
    }) || null
  );
}

/* On the flight results page:

  const params = new URLSearchParams(location.search);
  const matchId = params.get("match");

  useEffect(() => {
    if (!matchId || !offers.length) return;
    const suggestion = shortlist.find((s) => s._id === matchId); // or fetch it
    const hit = matchFlightOffer(offers, suggestion.ref);
    if (hit) {
      setSelectedOffer(hit);          // open the details/booking drawer immediately
      scrollToOffer(hit.offerId);
    } else {
      toast("That exact flight isn't available anymore — here are the closest options.");
    }
  }, [matchId, offers]);
*/
