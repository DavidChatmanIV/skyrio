// backend/routes/api/cars/cars.utils.js
// Turns Duffel Cars data into the shape Skyrio's Cars tab shows.
// Only real fields from Duffel — nothing is guessed or made up.

const CATEGORY = {
  mini: "Mini",
  economy: "Economy",
  compact: "Compact",
  compact_elite: "Compact Elite",
  intermediate: "Midsize",
  standard: "Standard",
  standard_elite: "Standard Elite",
  fullsize: "Full-size",
  fullsize_elite: "Full-size Elite",
  premium: "Premium",
  luxury: "Luxury",
  special: "Special",
};
const TYPE = {
  suv: "SUV",
  four_door: "4-door",
  two_or_four_door: "2/4-door",
  passenger_van: "Passenger van",
  pickup_extended_cab: "Pickup truck",
  convertible: "Convertible",
  special_offer_car: "Special offer",
  special: "Special",
};
const ACCESS = {
  in_terminal: "Counter in terminal",
  shuttle: "Shuttle from terminal",
};
const FUEL = { electric: "Electric", hybrid: "Hybrid", petrol: "Gas", diesel: "Diesel" };

const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    // Street directionals and airport words stay uppercase: "NW 42nd Ave", "MIA".
    .replace(/\b(Nw|Ne|Sw|Se|Intl|Ap)\b/g, (m) =>
      m === "Intl" ? "Intl." : m === "Ap" ? "Airport" : m.toUpperCase()
    );

export function rentalDays(pickupDate, pickupTime, dropoffDate, dropoffTime) {
  const a = Date.parse(`${pickupDate}T${pickupTime || "10:00"}:00Z`);
  const b = Date.parse(`${dropoffDate}T${dropoffTime || "10:00"}:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.ceil((b - a) / 86400000));
}

export function mileageText(m) {
  if (!m) return null;
  if (m.type === "unlimited") return "Unlimited mileage";
  if (m.type === "limited" && m.limit) return `${m.limit} ${m.unit || "miles"} included`;
  return null;
}

export function normalizeLocation(l = {}) {
  const a = l.address || {};
  const lat = Number(l.geographic_coordinates?.latitude);
  const lng = Number(l.geographic_coordinates?.longitude);
  return {
    name: titleCase(l.name) || "Rental counter",
    address: [titleCase(a.line_one), titleCase(a.city_name), a.region, a.postal_code]
      .filter(Boolean)
      .join(", "),
    city: titleCase(a.city_name),
    country: a.country_code || null,
    phone: l.phone_number || null,
    access: ACCESS[l.access] || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    instructions: (l.additional_information || [])
      .filter((i) => i?.text)
      .map((i) => ({ title: i.title || "Pickup instructions", text: i.text })),
    hours: (l.opening_hours || []).filter((h) => h?.from && h?.to),
  };
}

const textList = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((c) => c?.text)
    .map((c) => ({ title: c.title || null, text: c.text }));

/** A rate (search) or quote (after "Select") → card/checkout shape. */
export function normalizeCarOffer(r = {}, days = 1) {
  const car = r.car || {};
  const total = Number(r.total_amount);
  const sameReturn =
    r.pickup_location &&
    r.dropoff_location &&
    r.pickup_location.name === r.dropoff_location.name;
  return {
    id: r.id, // rae_… (rate) or qut_… (quote)
    supplier: { name: r.supplier?.name || "Rental company", logo: r.supplier?.logo_url || null },
    car: {
      name: car.name || "Car",
      code: car.code || null,
      category: CATEGORY[car.category] || titleCase(String(car.category || "").replace(/_/g, " ")) || null,
      type: TYPE[car.type] || null,
      image: car.images?.[0]?.url || null,
      passengers: car.max_passengers ?? null,
      bags: car.baggage ? { large: car.baggage.large ?? 0, small: car.baggage.small ?? 0 } : null,
      transmission: car.transmission ? titleCase(car.transmission) : null,
      airConditioning: car.air_conditioning === true,
      fuel: FUEL[car.fuel] || null,
    },
    mileage: mileageText(r.mileage),
    paymentType: r.payment_type || null,
    totalAmount: Number.isFinite(total) ? total : null,
    perDay: Number.isFinite(total) ? Math.round((total / days) * 100) / 100 : null,
    days,
    currency: r.total_currency || "USD",
    pickup: normalizeLocation(r.pickup_location),
    dropoff: sameReturn ? null : normalizeLocation(r.dropoff_location),
    // Present on quotes/bookings (Duffel asks these be shown to travelers).
    conditions: textList(r.conditions),
    privacyPolicies: textList(r.privacy_policies),
    charges: (Array.isArray(r.charges) ? r.charges : [])
      .filter((c) => c?.description)
      .map((c) => ({ description: c.description, amount: Number(c.amount), currency: c.currency })),
  };
}
