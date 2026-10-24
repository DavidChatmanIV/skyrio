// Where To Next — which routes the deal scan job checks, and where
// each airport sits on the map. Keep DESTINATIONS short: every one
// multiplies the number of LiteAPI searches per origin.

export const DESTINATIONS = [
  {
    code: "MIA",
    city: "Miami",
    lat: 25.795,
    lng: -80.29,
    tags: ["warm", "beach"],
  },
  {
    code: "MCO",
    city: "Orlando",
    lat: 28.431,
    lng: -81.308,
    tags: ["warm", "family"],
  },
  {
    code: "FLL",
    city: "Fort Lauderdale",
    lat: 26.072,
    lng: -80.15,
    tags: ["warm", "beach"],
  },
  {
    code: "TPA",
    city: "Tampa",
    lat: 27.976,
    lng: -82.533,
    tags: ["warm", "beach"],
  },
  {
    code: "SJU",
    city: "San Juan",
    lat: 18.439,
    lng: -66.002,
    tags: ["warm", "beach"],
  },
  {
    code: "CUN",
    city: "Cancún",
    lat: 21.036,
    lng: -86.877,
    tags: ["warm", "beach"],
  },
  {
    code: "PUJ",
    city: "Punta Cana",
    lat: 18.567,
    lng: -68.363,
    tags: ["warm", "beach"],
  },
  {
    code: "MBJ",
    city: "Montego Bay",
    lat: 18.504,
    lng: -77.913,
    tags: ["warm", "beach"],
  },
  { code: "ATL", city: "Atlanta", lat: 33.64, lng: -84.427, tags: ["city"] },
  {
    code: "CHS",
    city: "Charleston",
    lat: 32.899,
    lng: -80.04,
    tags: ["city", "warm"],
  },
  { code: "BNA", city: "Nashville", lat: 36.124, lng: -86.678, tags: ["city"] },
  {
    code: "MSY",
    city: "New Orleans",
    lat: 29.993,
    lng: -90.258,
    tags: ["city", "warm"],
  },
  { code: "ORD", city: "Chicago", lat: 41.974, lng: -87.907, tags: ["city"] },
  { code: "BOS", city: "Boston", lat: 42.366, lng: -71.01, tags: ["city"] },
  {
    code: "DEN",
    city: "Denver",
    lat: 39.856,
    lng: -104.674,
    tags: ["adventure"],
  },
  {
    code: "LAS",
    city: "Las Vegas",
    lat: 36.084,
    lng: -115.154,
    tags: ["city", "warm"],
  },
  {
    code: "LAX",
    city: "Los Angeles",
    lat: 33.942,
    lng: -118.408,
    tags: ["city", "warm", "beach"],
  },
  {
    code: "SFO",
    city: "San Francisco",
    lat: 37.621,
    lng: -122.379,
    tags: ["city"],
  },
  { code: "LHR", city: "London", lat: 51.47, lng: -0.454, tags: ["city"] },
  { code: "CDG", city: "Paris", lat: 49.01, lng: 2.548, tags: ["city"] },
];

// Airports close enough that a traveler would happily use either one.
// The map shows the cheapest airport in the home base's group.
export const AIRPORT_GROUPS = {
  NYC: ["EWR", "JFK", "LGA"],
  CHI: ["ORD", "MDW"],
  WAS: ["DCA", "IAD"],
  SFBAY: ["SFO", "SJC", "OAK"],
  SFLA: ["MIA", "FLL"],
};

// Always scanned, even before any user has saved a home base.
export const DEFAULT_ORIGINS = ["EWR", "JFK", "LGA"];

export function airportGroupFor(code) {
  const c = String(code || "").toUpperCase();
  for (const members of Object.values(AIRPORT_GROUPS)) {
    if (members.includes(c)) return members;
  }
  return c ? [c] : [];
}

export const DESTINATION_BY_CODE = Object.fromEntries(
  DESTINATIONS.map((d) => [d.code, d])
);
