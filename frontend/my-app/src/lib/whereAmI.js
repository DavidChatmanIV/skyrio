// "Use my location" → a city name like "Newark, NJ".
// The phone asks first. Only the city is used; exact coordinates are never
// saved or sent to Skyrio.

// Free, no-key reverse geocoder meant for browser use.
export async function cityFromCoords(lat, lng) {
  const r = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
  );
  if (!r.ok) throw new Error("lookup failed");
  const d = await r.json();
  const name = d.city || d.locality || d.principalSubdivision;
  if (!name) throw new Error("no city");
  const regionCode = (d.principalSubdivisionCode || "").split("-")[1] || "";
  const region = d.principalSubdivision || "";
  const country = d.countryCode || "";
  const short = country === "US" && regionCode ? regionCode : d.countryName || country;
  return {
    name,
    region,
    regionCode,
    country,
    label: short ? `${name}, ${short}` : name,
  };
}

export function getPosition(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout, maximumAge: 30 * 60 * 1000 }
    );
  });
}

/** One call: ask the phone, return { label: "Newark, NJ", ... }. */
export async function myCity() {
  const c = await getPosition();
  return cityFromCoords(c.latitude, c.longitude);
}

/** Short, friendly error for a failed "Use my location". */
export const locationError = (e) =>
  e?.code === 1
    ? "Location is off for this site. Type the city instead."
    : "Couldn't find your city. Type it instead.";
