// Type a country or US state ("Costa Rica", "Maryland") and the airport
// box lists the main airports there, so travelers don't need to know the
// airport. Testers asked for this ("not much of a traveler").
//
// Each entry: [code, city, airport name, nearby?]. "nearby" airports are
// just over the border but the usual way in (e.g. DCA/IAD for Maryland).
// Add regions or airports here; the rest of the airport details come from
// airportData when it has the code.

const A = (code, city, name, nearby = false) => ({ code, city, name, nearby });

const US_STATES = {
  Alabama: [
    A("BHM", "Birmingham", "Birmingham-Shuttlesworth"),
    A("HSV", "Huntsville", "Huntsville International"),
    A("MOB", "Mobile", "Mobile Regional"),
  ],
  Alaska: [
    A("ANC", "Anchorage", "Ted Stevens Anchorage"),
    A("FAI", "Fairbanks", "Fairbanks International"),
    A("JNU", "Juneau", "Juneau International"),
  ],
  Arizona: [
    A("PHX", "Phoenix", "Phoenix Sky Harbor"),
    A("TUS", "Tucson", "Tucson International"),
    A("AZA", "Mesa", "Phoenix-Mesa Gateway"),
  ],
  Arkansas: [
    A("LIT", "Little Rock", "Clinton National"),
    A("XNA", "Bentonville", "Northwest Arkansas National"),
  ],
  California: [
    A("LAX", "Los Angeles", "Los Angeles International"),
    A("SFO", "San Francisco", "San Francisco International"),
    A("SAN", "San Diego", "San Diego International"),
    A("SJC", "San Jose", "San Jose Mineta"),
    A("OAK", "Oakland", "Oakland International"),
    A("SMF", "Sacramento", "Sacramento International"),
    A("SNA", "Santa Ana", "John Wayne (Orange County)"),
    A("BUR", "Burbank", "Hollywood Burbank"),
    A("ONT", "Ontario", "Ontario International"),
    A("LGB", "Long Beach", "Long Beach"),
    A("PSP", "Palm Springs", "Palm Springs International"),
  ],
  Colorado: [
    A("DEN", "Denver", "Denver International"),
    A("COS", "Colorado Springs", "Colorado Springs"),
    A("ASE", "Aspen", "Aspen/Pitkin County"),
    A("EGE", "Vail", "Eagle County Regional"),
  ],
  Connecticut: [
    A("BDL", "Hartford", "Bradley International"),
    A("HVN", "New Haven", "Tweed-New Haven"),
  ],
  Delaware: [
    A("ILG", "Wilmington", "Wilmington"),
    A("PHL", "Philadelphia", "Philadelphia International", true),
    A("BWI", "Baltimore", "Baltimore/Washington International", true),
  ],
  Florida: [
    A("MCO", "Orlando", "Orlando International"),
    A("MIA", "Miami", "Miami International"),
    A("FLL", "Fort Lauderdale", "Fort Lauderdale-Hollywood"),
    A("TPA", "Tampa", "Tampa International"),
    A("JAX", "Jacksonville", "Jacksonville International"),
    A("RSW", "Fort Myers", "Southwest Florida International"),
    A("PBI", "West Palm Beach", "Palm Beach International"),
    A("SRQ", "Sarasota", "Sarasota-Bradenton"),
    A("PNS", "Pensacola", "Pensacola International"),
    A("EYW", "Key West", "Key West International"),
  ],
  Georgia: [
    A("ATL", "Atlanta", "Hartsfield-Jackson Atlanta"),
    A("SAV", "Savannah", "Savannah/Hilton Head"),
  ],
  Hawaii: [
    A("HNL", "Honolulu", "Daniel K. Inouye"),
    A("OGG", "Maui", "Kahului"),
    A("KOA", "Kona", "Ellison Onizuka Kona"),
    A("LIH", "Kauai", "Lihue"),
    A("ITO", "Hilo", "Hilo International"),
  ],
  Idaho: [A("BOI", "Boise", "Boise Airport")],
  Illinois: [
    A("ORD", "Chicago", "O'Hare International"),
    A("MDW", "Chicago", "Midway International"),
  ],
  Indiana: [A("IND", "Indianapolis", "Indianapolis International")],
  Iowa: [
    A("DSM", "Des Moines", "Des Moines International"),
    A("CID", "Cedar Rapids", "Eastern Iowa"),
  ],
  Kansas: [
    A("ICT", "Wichita", "Wichita Eisenhower"),
    A("MCI", "Kansas City", "Kansas City International", true),
  ],
  Kentucky: [
    A("SDF", "Louisville", "Louisville Muhammad Ali"),
    A("CVG", "Cincinnati", "Cincinnati/Northern Kentucky"),
    A("LEX", "Lexington", "Blue Grass"),
  ],
  Louisiana: [
    A("MSY", "New Orleans", "Louis Armstrong New Orleans"),
    A("BTR", "Baton Rouge", "Baton Rouge Metropolitan"),
  ],
  Maine: [
    A("PWM", "Portland", "Portland International Jetport"),
    A("BGR", "Bangor", "Bangor International"),
  ],
  Maryland: [
    A("BWI", "Baltimore", "Baltimore/Washington International"),
    A("DCA", "Washington", "Reagan National", true),
    A("IAD", "Washington", "Dulles International", true),
  ],
  Massachusetts: [A("BOS", "Boston", "Logan International")],
  Michigan: [
    A("DTW", "Detroit", "Detroit Metropolitan"),
    A("GRR", "Grand Rapids", "Gerald R. Ford International"),
  ],
  Minnesota: [A("MSP", "Minneapolis", "Minneapolis-St. Paul")],
  Mississippi: [
    A("JAN", "Jackson", "Jackson-Medgar Evers"),
    A("GPT", "Gulfport", "Gulfport-Biloxi"),
  ],
  Missouri: [
    A("STL", "St. Louis", "St. Louis Lambert"),
    A("MCI", "Kansas City", "Kansas City International"),
    A("SGF", "Springfield", "Springfield-Branson"),
  ],
  Montana: [
    A("BZN", "Bozeman", "Bozeman Yellowstone"),
    A("MSO", "Missoula", "Missoula Montana"),
    A("BIL", "Billings", "Billings Logan"),
  ],
  Nebraska: [A("OMA", "Omaha", "Eppley Airfield")],
  Nevada: [
    A("LAS", "Las Vegas", "Harry Reid International"),
    A("RNO", "Reno", "Reno-Tahoe International"),
  ],
  "New Hampshire": [
    A("MHT", "Manchester", "Manchester-Boston Regional"),
    A("BOS", "Boston", "Logan International", true),
  ],
  "New Jersey": [
    A("EWR", "Newark", "Newark Liberty International"),
    A("ACY", "Atlantic City", "Atlantic City International"),
    A("TTN", "Trenton", "Trenton-Mercer"),
  ],
  "New Mexico": [A("ABQ", "Albuquerque", "Albuquerque International Sunport")],
  "New York": [
    A("JFK", "New York", "John F. Kennedy International"),
    A("LGA", "New York", "LaGuardia"),
    A("EWR", "Newark", "Newark Liberty International", true),
    A("BUF", "Buffalo", "Buffalo Niagara"),
    A("ALB", "Albany", "Albany International"),
    A("ROC", "Rochester", "Greater Rochester"),
    A("SYR", "Syracuse", "Syracuse Hancock"),
    A("HPN", "White Plains", "Westchester County"),
    A("ISP", "Islip", "Long Island MacArthur"),
  ],
  "North Carolina": [
    A("CLT", "Charlotte", "Charlotte Douglas"),
    A("RDU", "Raleigh", "Raleigh-Durham"),
    A("GSO", "Greensboro", "Piedmont Triad"),
    A("AVL", "Asheville", "Asheville Regional"),
  ],
  "North Dakota": [
    A("FAR", "Fargo", "Hector International"),
    A("BIS", "Bismarck", "Bismarck Municipal"),
  ],
  Ohio: [
    A("CLE", "Cleveland", "Cleveland Hopkins"),
    A("CMH", "Columbus", "John Glenn Columbus"),
    A("CVG", "Cincinnati", "Cincinnati/Northern Kentucky", true),
    A("DAY", "Dayton", "Dayton International"),
  ],
  Oklahoma: [
    A("OKC", "Oklahoma City", "Will Rogers World"),
    A("TUL", "Tulsa", "Tulsa International"),
  ],
  Oregon: [
    A("PDX", "Portland", "Portland International"),
    A("EUG", "Eugene", "Eugene Airport"),
  ],
  Pennsylvania: [
    A("PHL", "Philadelphia", "Philadelphia International"),
    A("PIT", "Pittsburgh", "Pittsburgh International"),
    A("ABE", "Allentown", "Lehigh Valley International"),
  ],
  "Rhode Island": [A("PVD", "Providence", "Rhode Island T.F. Green")],
  "South Carolina": [
    A("CHS", "Charleston", "Charleston International"),
    A("MYR", "Myrtle Beach", "Myrtle Beach International"),
    A("GSP", "Greenville", "Greenville-Spartanburg"),
    A("CAE", "Columbia", "Columbia Metropolitan"),
  ],
  "South Dakota": [
    A("FSD", "Sioux Falls", "Sioux Falls Regional"),
    A("RAP", "Rapid City", "Rapid City Regional"),
  ],
  Tennessee: [
    A("BNA", "Nashville", "Nashville International"),
    A("MEM", "Memphis", "Memphis International"),
    A("TYS", "Knoxville", "McGhee Tyson"),
  ],
  Texas: [
    A("DFW", "Dallas", "Dallas/Fort Worth International"),
    A("DAL", "Dallas", "Dallas Love Field"),
    A("IAH", "Houston", "George Bush Intercontinental"),
    A("HOU", "Houston", "William P. Hobby"),
    A("AUS", "Austin", "Austin-Bergstrom"),
    A("SAT", "San Antonio", "San Antonio International"),
    A("ELP", "El Paso", "El Paso International"),
  ],
  Utah: [A("SLC", "Salt Lake City", "Salt Lake City International")],
  Vermont: [A("BTV", "Burlington", "Burlington International")],
  Virginia: [
    A("IAD", "Washington", "Dulles International"),
    A("DCA", "Washington", "Reagan National"),
    A("RIC", "Richmond", "Richmond International"),
    A("ORF", "Norfolk", "Norfolk International"),
  ],
  Washington: [
    A("SEA", "Seattle", "Seattle-Tacoma International"),
    A("GEG", "Spokane", "Spokane International"),
  ],
  "West Virginia": [A("CRW", "Charleston", "Yeager")],
  Wisconsin: [
    A("MKE", "Milwaukee", "Milwaukee Mitchell"),
    A("MSN", "Madison", "Dane County Regional"),
  ],
  Wyoming: [A("JAC", "Jackson Hole", "Jackson Hole Airport")],
  "Washington DC": [
    A("DCA", "Washington", "Reagan National"),
    A("IAD", "Washington", "Dulles International"),
    A("BWI", "Baltimore", "Baltimore/Washington International"),
  ],
  "Puerto Rico": [A("SJU", "San Juan", "Luis Muñoz Marín International")],
};

const COUNTRIES = {
  "Costa Rica": [
    A("SJO", "San José", "Juan Santamaría International"),
    A("LIR", "Liberia", "Guanacaste (Daniel Oduber)"),
  ],
  Mexico: [
    A("CUN", "Cancún", "Cancún International"),
    A("MEX", "Mexico City", "Benito Juárez International"),
    A("SJD", "Los Cabos", "Los Cabos International"),
    A("PVR", "Puerto Vallarta", "Gustavo Díaz Ordaz"),
    A("GDL", "Guadalajara", "Guadalajara International"),
    A("MTY", "Monterrey", "Monterrey International"),
    A("CZM", "Cozumel", "Cozumel International"),
    A("OAX", "Oaxaca", "Oaxaca International"),
  ],
  "Dominican Republic": [
    A("PUJ", "Punta Cana", "Punta Cana International"),
    A("SDQ", "Santo Domingo", "Las Américas International"),
    A("POP", "Puerto Plata", "Gregorio Luperón"),
  ],
  Jamaica: [
    A("MBJ", "Montego Bay", "Sangster International"),
    A("KIN", "Kingston", "Norman Manley International"),
  ],
  Bahamas: [A("NAS", "Nassau", "Lynden Pindling International")],
  Aruba: [A("AUA", "Oranjestad", "Queen Beatrix International")],
  Barbados: [A("BGI", "Bridgetown", "Grantley Adams International")],
  "Turks and Caicos": [
    A("PLS", "Providenciales", "Providenciales International"),
  ],
  "St. Lucia": [A("UVF", "Vieux Fort", "Hewanorra International")],
  Belize: [A("BZE", "Belize City", "Philip S.W. Goldson International")],
  Panama: [A("PTY", "Panama City", "Tocumen International")],
  Colombia: [
    A("BOG", "Bogotá", "El Dorado International"),
    A("MDE", "Medellín", "José María Córdova"),
    A("CTG", "Cartagena", "Rafael Núñez International"),
  ],
  Peru: [
    A("LIM", "Lima", "Jorge Chávez International"),
    A("CUZ", "Cusco", "Alejandro Velasco Astete"),
  ],
  Brazil: [
    A("GRU", "São Paulo", "Guarulhos International"),
    A("GIG", "Rio de Janeiro", "Galeão International"),
  ],
  Canada: [
    A("YYZ", "Toronto", "Toronto Pearson"),
    A("YVR", "Vancouver", "Vancouver International"),
    A("YUL", "Montréal", "Montréal-Trudeau"),
    A("YYC", "Calgary", "Calgary International"),
    A("YOW", "Ottawa", "Ottawa Macdonald-Cartier"),
  ],
  "United Kingdom": [
    A("LHR", "London", "Heathrow"),
    A("LGW", "London", "Gatwick"),
    A("MAN", "Manchester", "Manchester Airport"),
    A("EDI", "Edinburgh", "Edinburgh Airport"),
  ],
  Ireland: [A("DUB", "Dublin", "Dublin Airport")],
  France: [
    A("CDG", "Paris", "Charles de Gaulle"),
    A("ORY", "Paris", "Orly"),
    A("NCE", "Nice", "Nice Côte d'Azur"),
  ],
  Italy: [
    A("FCO", "Rome", "Fiumicino"),
    A("MXP", "Milan", "Malpensa"),
    A("VCE", "Venice", "Marco Polo"),
    A("NAP", "Naples", "Naples International"),
  ],
  Spain: [
    A("MAD", "Madrid", "Adolfo Suárez Madrid-Barajas"),
    A("BCN", "Barcelona", "Barcelona-El Prat"),
    A("AGP", "Málaga", "Málaga-Costa del Sol"),
    A("PMI", "Palma de Mallorca", "Palma de Mallorca"),
  ],
  Portugal: [
    A("LIS", "Lisbon", "Humberto Delgado"),
    A("OPO", "Porto", "Francisco Sá Carneiro"),
  ],
  Germany: [
    A("FRA", "Frankfurt", "Frankfurt Airport"),
    A("MUC", "Munich", "Munich Airport"),
    A("BER", "Berlin", "Berlin Brandenburg"),
  ],
  Netherlands: [A("AMS", "Amsterdam", "Schiphol")],
  Greece: [
    A("ATH", "Athens", "Athens International"),
    A("JTR", "Santorini", "Santorini (Thira)"),
    A("JMK", "Mykonos", "Mykonos Island"),
  ],
  Iceland: [A("KEF", "Reykjavík", "Keflavík International")],
  Turkey: [A("IST", "Istanbul", "Istanbul Airport")],
  Morocco: [
    A("RAK", "Marrakesh", "Marrakesh Menara"),
    A("CMN", "Casablanca", "Mohammed V International"),
  ],
  Egypt: [A("CAI", "Cairo", "Cairo International")],
  Ghana: [A("ACC", "Accra", "Kotoka International")],
  Nigeria: [
    A("LOS", "Lagos", "Murtala Muhammed International"),
    A("ABV", "Abuja", "Nnamdi Azikiwe International"),
  ],
  "South Africa": [
    A("JNB", "Johannesburg", "O.R. Tambo International"),
    A("CPT", "Cape Town", "Cape Town International"),
  ],
  "United Arab Emirates": [
    A("DXB", "Dubai", "Dubai International"),
    A("AUH", "Abu Dhabi", "Zayed International"),
  ],
  Japan: [
    A("HND", "Tokyo", "Haneda"),
    A("NRT", "Tokyo", "Narita International"),
    A("KIX", "Osaka", "Kansai International"),
  ],
  "South Korea": [A("ICN", "Seoul", "Incheon International")],
  Thailand: [
    A("BKK", "Bangkok", "Suvarnabhumi"),
    A("HKT", "Phuket", "Phuket International"),
  ],
  Australia: [
    A("SYD", "Sydney", "Sydney Kingsford Smith"),
    A("MEL", "Melbourne", "Melbourne Airport"),
  ],
};

// Other names people type for the same place.
const ALIASES = {
  uk: "United Kingdom",
  england: "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  scotland: "United Kingdom",
  uae: "United Arab Emirates",
  emirates: "United Arab Emirates",
  korea: "South Korea",
  holland: "Netherlands",
  dr: "Dominican Republic",
  "the bahamas": "Bahamas",
  "turks & caicos": "Turks and Caicos",
  "saint lucia": "St. Lucia",
  "st lucia": "St. Lucia",
  dc: "Washington DC",
  "washington d.c.": "Washington DC",
  "washington dc": "Washington DC",
  "district of columbia": "Washington DC",
  "washington state": "Washington",
  cdmx: "Mexico",
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9& .]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const INDEX = [
  ...Object.entries(US_STATES).map(([name, airports]) => ({
    name,
    airports,
    kind: "state",
  })),
  ...Object.entries(COUNTRIES).map(([name, airports]) => ({
    name,
    airports,
    kind: "country",
  })),
].map((r) => ({ ...r, key: norm(r.name) }));

/**
 * The country or state the text names, or null.
 * Exact name or alias always matches; a partial name matches from 4
 * letters ("costa" → Costa Rica, "mary" → Maryland). Short text like
 * "la" never matches, so airport codes still search normally.
 */
export function findRegion(text) {
  const q = norm(text);
  if (q.length < 2) return null;
  const alias = ALIASES[q];
  if (alias) return INDEX.find((r) => r.name === alias) || null;
  const exact = INDEX.find((r) => r.key === q);
  if (exact) return exact;
  if (q.length < 4) return null;
  return INDEX.find((r) => r.key.startsWith(q)) || null;
}
