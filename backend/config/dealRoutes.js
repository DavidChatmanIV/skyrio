// Where To Next — which routes the deal scan job checks, and where
// each airport sits on the map. Keep DESTINATIONS short: every one
// multiplies the number of LiteAPI searches per origin.
//
// hotelCity + country are what the hotel search uses, so stays are found
// in the city itself, not around the airport.
//
// avgHighF: typical (long-term average) daily HIGH temperature in °F for
// each month, Jan → Dec. "Warm weather" uses the month of the trip, so a
// city only counts as warm when it usually is at that time of year.
// These are climate averages, not forecasts, and the page says so.

export const WARM_AVG_HIGH_F = 75;

export const DESTINATIONS = [
  {
    code: "MIA",
    city: "Miami",
    hotelCity: "Miami",
    country: "US",
    lat: 25.795,
    lng: -80.29,
    tags: ["beach"],
    avgHighF: [76, 78, 80, 83, 87, 89, 91, 91, 89, 86, 82, 78],
  },
  {
    code: "MCO",
    city: "Orlando",
    hotelCity: "Orlando",
    country: "US",
    lat: 28.431,
    lng: -81.308,
    tags: ["family"],
    avgHighF: [71, 74, 78, 83, 88, 91, 92, 92, 90, 85, 79, 73],
  },
  {
    code: "FLL",
    city: "Fort Lauderdale",
    hotelCity: "Fort Lauderdale",
    country: "US",
    lat: 26.072,
    lng: -80.15,
    tags: ["beach"],
    avgHighF: [76, 77, 80, 83, 86, 89, 90, 91, 89, 86, 81, 78],
  },
  {
    code: "TPA",
    city: "Tampa",
    hotelCity: "Tampa",
    country: "US",
    lat: 27.976,
    lng: -82.533,
    tags: ["beach"],
    avgHighF: [70, 73, 77, 81, 87, 90, 90, 91, 89, 84, 78, 72],
  },
  {
    code: "SJU",
    city: "San Juan",
    hotelCity: "San Juan",
    country: "PR",
    lat: 18.439,
    lng: -66.002,
    tags: ["beach"],
    avgHighF: [83, 84, 85, 86, 87, 88, 88, 89, 89, 88, 86, 84],
  },
  {
    code: "CUN",
    city: "Cancún",
    hotelCity: "Cancun",
    country: "MX",
    lat: 21.036,
    lng: -86.877,
    tags: ["beach"],
    avgHighF: [82, 83, 85, 88, 90, 91, 92, 92, 91, 88, 85, 83],
  },
  {
    code: "PUJ",
    city: "Punta Cana",
    hotelCity: "Punta Cana",
    country: "DO",
    lat: 18.567,
    lng: -68.363,
    tags: ["beach"],
    avgHighF: [84, 84, 85, 86, 87, 88, 89, 89, 89, 88, 86, 84],
  },
  {
    code: "MBJ",
    city: "Montego Bay",
    hotelCity: "Montego Bay",
    country: "JM",
    lat: 18.504,
    lng: -77.913,
    tags: ["beach"],
    avgHighF: [86, 86, 87, 87, 88, 89, 90, 90, 90, 89, 88, 87],
  },
  {
    code: "ATL",
    city: "Atlanta",
    hotelCity: "Atlanta",
    country: "US",
    lat: 33.64,
    lng: -84.427,
    tags: ["city"],
    avgHighF: [53, 57, 65, 73, 80, 86, 89, 88, 82, 73, 63, 55],
  },
  {
    code: "CHS",
    city: "Charleston",
    hotelCity: "Charleston",
    country: "US",
    lat: 32.899,
    lng: -80.04,
    tags: ["city"],
    avgHighF: [60, 64, 71, 77, 84, 89, 91, 90, 85, 77, 69, 62],
  },
  {
    code: "BNA",
    city: "Nashville",
    hotelCity: "Nashville",
    country: "US",
    lat: 36.124,
    lng: -86.678,
    tags: ["city"],
    avgHighF: [49, 54, 63, 72, 80, 87, 90, 89, 83, 73, 61, 51],
  },
  {
    code: "MSY",
    city: "New Orleans",
    hotelCity: "New Orleans",
    country: "US",
    lat: 29.993,
    lng: -90.258,
    tags: ["city"],
    avgHighF: [62, 66, 73, 79, 85, 90, 91, 92, 88, 80, 71, 64],
  },
  {
    code: "ORD",
    city: "Chicago",
    hotelCity: "Chicago",
    country: "US",
    lat: 41.974,
    lng: -87.907,
    tags: ["city"],
    avgHighF: [32, 36, 47, 59, 70, 80, 84, 82, 75, 62, 48, 36],
  },
  {
    code: "BOS",
    city: "Boston",
    hotelCity: "Boston",
    country: "US",
    lat: 42.366,
    lng: -71.01,
    tags: ["city"],
    avgHighF: [37, 39, 46, 57, 67, 77, 82, 81, 73, 62, 52, 42],
  },
  {
    code: "DEN",
    city: "Denver",
    hotelCity: "Denver",
    country: "US",
    lat: 39.856,
    lng: -104.674,
    tags: ["adventure"],
    avgHighF: [45, 47, 55, 61, 71, 82, 89, 87, 79, 66, 53, 45],
  },
  {
    code: "LAS",
    city: "Las Vegas",
    hotelCity: "Las Vegas",
    country: "US",
    lat: 36.084,
    lng: -115.154,
    tags: ["city"],
    avgHighF: [58, 62, 70, 78, 88, 99, 104, 102, 94, 81, 66, 57],
  },
  {
    code: "LAX",
    city: "Los Angeles",
    hotelCity: "Los Angeles",
    country: "US",
    lat: 33.942,
    lng: -118.408,
    tags: ["city", "beach"],
    avgHighF: [68, 68, 70, 72, 74, 78, 83, 84, 83, 79, 73, 68],
  },
  {
    code: "SFO",
    city: "San Francisco",
    hotelCity: "San Francisco",
    country: "US",
    lat: 37.621,
    lng: -122.379,
    tags: ["city"],
    avgHighF: [57, 60, 62, 64, 67, 70, 71, 72, 73, 70, 63, 57],
  },
  {
    code: "LHR",
    city: "London",
    hotelCity: "London",
    country: "GB",
    lat: 51.47,
    lng: -0.454,
    tags: ["city"],
    avgHighF: [47, 48, 53, 58, 64, 70, 74, 73, 67, 59, 52, 47],
  },
  {
    code: "CDG",
    city: "Paris",
    hotelCity: "Paris",
    country: "FR",
    lat: 49.01,
    lng: 2.548,
    tags: ["city"],
    avgHighF: [45, 47, 54, 60, 67, 73, 77, 77, 70, 61, 51, 46],
  },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Typical weather for a destination in the month a trip starts.
// Returns { month: "November", avgHighF: 82, warm: true } or null.
export function climateFor(code, isoDate) {
  const place = DESTINATION_BY_CODE[code];
  const m = Number(String(isoDate || "").slice(5, 7)) - 1;
  if (!place?.avgHighF || !(m >= 0 && m < 12)) return null;
  const avgHighF = place.avgHighF[m];
  return { month: MONTHS[m], avgHighF, warm: avgHighF >= WARM_AVG_HIGH_F };
}

// Where each home-base airport is, for the route line on the map
// (home base → tapped city). Covers the airports in the landing page's
// "You are here" picker; an airport missing here just gets no line.
export const ORIGIN_COORDS = {
  EWR: [40.692, -74.174],
  JFK: [40.641, -73.778],
  LGA: [40.777, -73.873],
  LAX: [33.942, -118.408],
  ORD: [41.974, -87.907],
  MDW: [41.786, -87.752],
  ATL: [33.64, -84.427],
  MIA: [25.795, -80.29],
  FLL: [26.072, -80.15],
  DFW: [32.899, -97.04],
  IAH: [29.99, -95.337],
  DEN: [39.856, -104.674],
  SEA: [47.45, -122.309],
  SFO: [37.621, -122.379],
  SJC: [37.364, -121.929],
  OAK: [37.712, -122.22],
  BOS: [42.366, -71.01],
  PHL: [39.874, -75.243],
  DCA: [38.852, -77.04],
  IAD: [38.953, -77.456],
  MSP: [44.885, -93.222],
  DTW: [42.216, -83.355],
  PHX: [33.437, -112.008],
  LAS: [36.084, -115.154],
  MCO: [28.431, -81.308],
  TPA: [27.976, -82.533],
  CLT: [35.214, -80.943],
  BNA: [36.124, -86.678],
  AUS: [30.197, -97.666],
  HNL: [21.319, -157.922],
};

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
