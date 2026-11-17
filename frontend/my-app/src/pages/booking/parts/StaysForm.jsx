// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { searchAirports } from "@/data/airportData";
import { useState, useCallback, useEffect, useRef } from "react";
import { Select, message as antdMessage } from "antd";
import { SearchOutlined, LoadingOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import { Zap, MapPin, Calendar, Users, Check } from "lucide-react";
import { API, MAX_ROOMS_PER_TRIP, GuestsRoomsPicker, weekendRange } from "./shared";

// Only used when someone types a city WITHOUT picking a suggestion
// (a picked suggestion has an exact placeId, so country doesn't matter).
export const STAY_COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["GB", "United Kingdom"],
  ["IE", "Ireland"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["PT", "Portugal"],
  ["IT", "Italy"],
  ["DE", "Germany"],
  ["NL", "Netherlands"],
  ["GR", "Greece"],
  ["CH", "Switzerland"],
  ["AT", "Austria"],
  ["TR", "Turkey"],
  ["AE", "United Arab Emirates"],
  ["EG", "Egypt"],
  ["MA", "Morocco"],
  ["ZA", "South Africa"],
  ["KE", "Kenya"],
  ["NG", "Nigeria"],
  ["GH", "Ghana"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["CN", "China"],
  ["TH", "Thailand"],
  ["SG", "Singapore"],
  ["ID", "Indonesia"],
  ["VN", "Vietnam"],
  ["PH", "Philippines"],
  ["IN", "India"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["BR", "Brazil"],
  ["AR", "Argentina"],
  ["CO", "Colombia"],
  ["PE", "Peru"],
  ["CR", "Costa Rica"],
  ["DO", "Dominican Republic"],
  ["JM", "Jamaica"],
  ["BS", "Bahamas"],
  ["PR", "Puerto Rico"],
];

// Picks the country out of a suggestion's secondary text ("Florida, USA" → US).
export const COUNTRY_ALIASES = { USA: "US", "U.S.": "US", UK: "GB", UAE: "AE" };
export function countryFromText(text = "") {
  const t = text.toLowerCase();
  const alias = Object.entries(COUNTRY_ALIASES).find(([a]) =>
    new RegExp(`\\b${a.replace(/\./g, "\\.").toLowerCase()}\\b`).test(t)
  );
  if (alias) return alias[1];
  return (
    STAY_COUNTRIES.find(([, name]) => t.includes(name.toLowerCase()))?.[0] ??
    null
  );
}

export const POPULAR_STAYS = [
  { city: "Miami", country: "US" },
  { city: "New York", country: "US" },
  { city: "Las Vegas", country: "US" },
  { city: "Orlando", country: "US" },
  { city: "Cancun", country: "MX" },
  { city: "London", country: "GB" },
  { city: "Paris", country: "FR" },
  { city: "Tokyo", country: "JP" },
];

// Recent stay searches — a per-browser convenience only, so every read/write is guarded.
export const RECENT_STAYS_KEY = "skyrio:recentStays";
export function loadRecentStays() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_STAYS_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, 4) : [];
  } catch {
    return [];
  }
}
export function saveRecentStay(entry) {
  try {
    const key = (e) =>
      `${(e.placeId || e.city).toLowerCase()}|${e.checkin}|${e.checkout}`;
    const next = [
      entry,
      ...loadRecentStays().filter((e) => key(e) !== key(entry)),
    ].slice(0, 4);
    localStorage.setItem(RECENT_STAYS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadRecentStays();
  }
}

// XP a stay booking earns (before plan multiplier). Must match getBookingXP()
// for hotels in the backend config/xpRules.js — currently the flat 150.
export const STAY_BOOKING_XP = 150;

// ── Place suggestions ──
// Splits a LiteAPI /data/places result into a bold name line and a region
// line ("Miami Beach" / "Florida, United States"), and works out what kind
// of place it is so the dropdown can show the right icon.
export function normalizePlace(p) {
  let name = String(
    p.displayName ?? p.name ?? p.formattedAddress ?? "Unknown place"
  );
  const full = String(p.formattedAddress ?? "");
  let secondary = String(p.secondaryText ?? "");
  if (!secondary && full) {
    secondary = full.toLowerCase().startsWith(name.toLowerCase())
      ? full.slice(name.length).replace(/^[\s,–-]+/, "")
      : full === name
      ? ""
      : full;
  }
  if (!secondary && name.includes(", ")) {
    const [first, ...rest] = name.split(", ");
    name = first;
    secondary = rest.join(", ");
  }
  if (!secondary && p.country) secondary = String(p.country);
  const types = []
    .concat(p.types ?? p.type ?? [])
    .map((t) => String(t).toLowerCase());
  return {
    placeId: p.placeId ?? p.id,
    displayName: name,
    secondaryText: secondary,
    types,
  };
}

export const CITY_TYPES = [
  "locality",
  "sublocality",
  "neighborhood",
  "administrative_area",
  "postal_town",
  "colloquial_area",
  "city",
  "political",
  "country",
];
export function placeKind(types = []) {
  if (types.some((t) => t.includes("lodging") || t.includes("hotel")))
    return "hotel";
  if (types.some((t) => CITY_TYPES.some((c) => t.startsWith(c)))) return "city";
  if (types.length === 0) return "city";
  return "poi";
}

export function PlaceKindIcon({ kind, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (kind === "hotel") {
    return (
      <svg {...common}>
        <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
        <circle cx="7" cy="11" r="1.6" />
      </svg>
    );
  }
  if (kind === "poi") {
    return (
      <svg {...common}>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.3" />
      </svg>
    );
  }
  if (kind === "recent") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 21V5.5L10 3v18M10 21V9l10 3v9M3 21h18" />
      <path d="M6.5 8h1M6.5 11.5h1M6.5 15h1M13 14h1M16.5 14h1M13 17.5h1M16.5 17.5h1" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// StaysForm — real hotel search wired to
// /api/hotels/lookup → /api/hotels/search
// ─────────────────────────────────────────────
export function StaysForm({
  onSearch,
  onDestChange,
  onDatesChange,
  onSearchStart,
  onSearchEnd,
  initial = null,
}) {
  const [cityName, setCityName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  // Selected place from the autocomplete dropdown, if any. When set,
  // search uses this placeId directly (LiteAPI's preferred, exact way
  // to resolve a destination) instead of the countryCode+cityName
  // fallback, which LiteAPI's own docs note requires an EXACT string
  // match and can silently return zero hotels for larger/ambiguous
  // cities.
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [dates, setDates] = useState([null, null]);
  // Travelers/rooms as plain numbers instead of a handful of fixed
  // presets ("1 traveler, 1 room" / "2 travelers, 2 rooms" etc.) — those
  // presets topped out at 3 travelers / 2 rooms, which doesn't work for
  // a big party (a sports team, a large family reunion). MAX_ROOMS_PER_TRIP
  // is the same cap already used for the room cart, kept consistent here.
  const [adults, setAdults] = useState(2);
  const [numRooms, setNumRooms] = useState(1);
  const [loading, setLoading] = useState(false);

  // Prefill city, dates and guests from the link (e.g. a Sync Together trip).
  const stayPrefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || stayPrefilledRef.current) return;
    stayPrefilledRef.current = true;
    if (initial.city) {
      setCityName(initial.city);
      onDestChange?.(initial.city);
    }
    const start = initial.checkin ? dayjs(initial.checkin) : null;
    const end = initial.checkout ? dayjs(initial.checkout) : null;
    if (start?.isValid() && end?.isValid()) {
      setDates([start, end]);
      onDatesChange?.({ dates: [start, end], nights: end.diff(start, "day") });
    }
    const n = Number(initial.adults);
    if (Number.isInteger(n) && n >= 1 && n <= 40) setAdults(n);
    const r = Number(initial.rooms);
    if (Number.isInteger(r) && r >= 1 && r <= MAX_ROOMS_PER_TRIP)
      setNumRooms(r);
    // From the trip page: show results immediately — no extra Search tap.
    if (
      initial.autoSearch &&
      start?.isValid() &&
      end?.isValid() &&
      (initial.city || initial.hotel)
    ) {
      (async () => {
        // Resolve the city to an exact place first — a name-only lookup
        // assumes the default country and misses cities like Cancún or Paris.
        let place = null;
        if (initial.city && !initial.hotel) {
          try {
            const res = await fetch(
              `${API}/api/hotels/places?${new URLSearchParams({
                query: initial.city,
              })}`
            );
            const data = await res.json();
            const first =
              data?.ok && data.places?.[0]
                ? normalizePlace(data.places[0])
                : null;
            if (first?.placeId) {
              place = first;
              setSelectedPlace(first);
              setCityName(
                first.secondaryText
                  ? `${first.displayName}, ${first.secondaryText}`
                  : first.displayName
              );
              const cc = countryFromText(first.secondaryText);
              if (cc) setCountryCode(cc);
            }
          } catch {
            /* fall back to the name lookup */
          }
        }
        handleSearch({
          city: initial.city || "",
          dates: [start, end],
          adults: Number.isInteger(n) ? n : undefined,
          rooms: Number.isInteger(r) ? r : undefined,
          hotel: initial.hotel || null,
          place,
        });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // ── Location autocomplete, backed by LiteAPI's own /data/places
  // endpoint (via /api/hotels/places) — NOT /data/hotels. This is a
  // real, purpose-built autocomplete (Google Places under the hood),
  // but LiteAPI bills it per-request. Debounce (450ms) and a 3-char
  // minimum are both deliberate cost guards — don't loosen either
  // without checking the cost impact on your LiteAPI account.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestDebounceRef = useRef(null);
  const suggestAbortRef = useRef(null);
  const cityFieldRef = useRef(null);
  const cityInputRef = useRef(null);
  // Recent + popular destinations, shown when the box is focused and empty.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // Close the dropdown on outside click — same pattern as the
  // "More" tab menu elsewhere in this file.
  useEffect(() => {
    if (!suggestOpen && !quickMenuOpen) return;
    const handler = (e) => {
      if (cityFieldRef.current && !cityFieldRef.current.contains(e.target)) {
        setSuggestOpen(false);
        setQuickMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestOpen, quickMenuOpen]);

  const fetchPlaceSuggestions = useCallback((query) => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);

    const trimmed = query.trim();
    // 3-char minimum + 450ms debounce are cost guards for a billed
    // endpoint (see note above) — not just UX polish.
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    suggestDebounceRef.current = setTimeout(async () => {
      if (suggestAbortRef.current) suggestAbortRef.current.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;
      setSuggestLoading(true);

      try {
        const params = new URLSearchParams({ query: trimmed });
        const res = await fetch(`${API}/api/hotels/places?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // Surfaced to the console (not the user) so this is
          // debuggable from devtools — a silent empty dropdown with
          // zero feedback is exactly what makes "the autocomplete
          // doesn't work" hard to diagnose. Common causes: the
          // /api/hotels/places route not yet deployed/registered on
          // the backend, or the LiteAPI key lacking access to the
          // (billed) /data/places endpoint.
          console.error("[places autocomplete] request failed:", data);
          setSuggestions([]);
          setSuggestOpen(false);
          return;
        }

        // NOTE: verify these field names against your actual
        // /api/hotels/places response — LiteAPI's own wiring docs
        // reference storing `{ placeId, displayName }`, but the raw
        // shape may nest displayName differently or use `name`.
        const places = (data.places ?? []).slice(0, 8).map(normalizePlace);

        setSuggestions(places);
        setSuggestOpen(places.length > 0);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[places autocomplete] request error:", err);
          setSuggestions([]);
          setSuggestOpen(false);
        }
      } finally {
        setSuggestLoading(false);
      }
    }, 450);
  }, []);

  const handleCityInputChange = (e) => {
    const val = e.target.value;
    setCityName(val);
    // Typing again after picking a suggestion means they're looking
    // for something else — don't silently keep searching the old place.
    if (selectedPlace) setSelectedPlace(null);
    setHighlightedIndex(-1);
    setQuickMenuOpen(!val.trim());
    fetchPlaceSuggestions(val);
  };

  const clearCity = () => {
    setCityName("");
    setSelectedPlace(null);
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlightedIndex(-1);
    setQuickMenuOpen(true);
    cityInputRef.current?.focus();
  };

  const handleSelectPlaceSuggestion = (place) => {
    // Show the full place in the box: "Miami Beach, Florida, United States".
    setCityName(
      place.secondaryText
        ? `${place.displayName}, ${place.secondaryText}`
        : place.displayName
    );
    setSelectedPlace(place);
    setQuickMenuOpen(false);
    // Keep the fallback country in step with the place they picked.
    const cc = countryFromText(place.secondaryText);
    if (cc) setCountryCode(cc);
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlightedIndex(-1);
  };

  const [recentStays, setRecentStays] = useState(loadRecentStays);

  // Popular destination chip → fill the city and look it up, so the search
  // can use the exact place instead of guessing by name.
  const handlePickPopular = ({ city, country }) => {
    setCityName(city);
    setSelectedPlace(null);
    setCountryCode(country);
    setQuickMenuOpen(false);
    fetchPlaceSuggestions(city);
    cityInputRef.current?.focus();
  };

  // Recent search chip → restore it. If its dates are still ahead, search right away.
  const handlePickRecent = (r) => {
    const place = r.placeId
      ? {
          placeId: r.placeId,
          displayName: r.city,
          secondaryText: r.secondaryText || "",
        }
      : null;
    setCityName(r.secondaryText ? `${r.city}, ${r.secondaryText}` : r.city);
    setSelectedPlace(place);
    setQuickMenuOpen(false);
    if (r.countryCode) setCountryCode(r.countryCode);
    if (r.adults) setAdults(r.adults);
    if (r.rooms) setNumRooms(r.rooms);
    const start = dayjs(r.checkin);
    const end = dayjs(r.checkout);
    if (start.isValid() && end.isValid() && !start.isBefore(dayjs(), "day")) {
      handleDatesChange([start, end]);
      handleSearch({
        city: r.city,
        dates: [start, end],
        adults: r.adults,
        rooms: r.rooms,
        place,
      });
    } else {
      antdMessage.info(
        "Pick new dates for this trip — the old ones have passed."
      );
    }
  };

  // Arrow-key + Enter/Escape navigation — same interaction pattern as
  // the airport search on Flights, so this dropdown doesn't feel like
  // a different, lesser control.
  const handleCityInputKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Tab") setQuickMenuOpen(false);
    if (e.key === "Tab") setSuggestOpen(false);
    // Enter with nothing highlighted runs the search.
    if (e.key === "Enter" && (!suggestOpen || highlightedIndex < 0)) {
      e.preventDefault();
      setSuggestOpen(false);
      handleSearch();
      return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectPlaceSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleDatesChange = useCallback(
    (v) => {
      const nd = v ?? [null, null];
      setDates(nd);
      if (nd[0] && nd[1])
        onDatesChange?.({ dates: nd, nights: nd[1].diff(nd[0], "day") });
      else onDatesChange?.({ dates: nd, nights: null });
    },
    [onDatesChange]
  );

  // Choose which hotels to price so every star level gets a fair share
  // (5★, 4★, 3★, then the rest), keeping LiteAPI's order inside each level.
  // Without this, the first 15 found could all be 2–3★, and "4★ and up"
  // would show almost nothing.
  function pickHotelMix(list, max) {
    if (list.length <= max) return list;
    const levels = [5, 4, 3, "other"];
    const groups = Object.fromEntries(levels.map((l) => [l, []]));
    for (const h of list) {
      const s = Math.floor(Number(h.stars));
      groups[s >= 3 && s <= 5 ? s : "other"].push(h);
    }
    const picked = [];
    // Round-robin across levels until full, so no level crowds out the rest.
    while (picked.length < max && levels.some((l) => groups[l].length)) {
      for (const l of levels) {
        if (picked.length >= max) break;
        const next = groups[l].shift();
        if (next) picked.push(next);
      }
    }
    return picked;
  }

  // opts lets a prefilled link run the search right away with its own
  // values (state updates aren't visible until the next render), and
  // `hotel` searches just one hotel — the Sync Together group's hotel.
  const handleSearch = async (opts = {}) => {
    const qCity = typeof opts.city === "string" ? opts.city : cityName;
    const qDates = Array.isArray(opts.dates) ? opts.dates : dates;
    const qAdults = Number(opts.adults) || adults;
    const qRooms = Number(opts.rooms) || numRooms;
    const pinned = opts.hotel?.hotelId ? opts.hotel : null;
    if (!pinned && !qCity.trim())
      return antdMessage.warning("Enter a destination city");
    if (!qDates[0] || !qDates[1])
      return antdMessage.warning("Select check-in and check-out dates");
    if (!pinned && qRooms > qAdults)
      return antdMessage.warning("Each room needs a traveler.");

    // Use the exact place whenever we have one: the picked suggestion, or —
    // if they typed a city and hit Search without picking — the suggestion
    // that matches what they typed. Name-only lookups often return nothing.
    // Compare against the name part only ("miami beach" from "Miami Beach, Florida…").
    const typed = qCity.split(",")[0].trim().toLowerCase();
    const place =
      opts.place !== undefined
        ? opts.place
        : selectedPlace ??
          suggestions.find((s) =>
            s.displayName.toLowerCase().startsWith(typed)
          ) ??
          suggestions.find((s) =>
            s.displayName.toLowerCase().includes(typed)
          ) ??
          null;
    if (place && place !== selectedPlace) setSelectedPlace(place);
    setSuggestOpen(false);

    setLoading(true);
    onSearchStart?.();

    try {
      // ── Step 1: resolve destination → hotelIds ──
      // Prefer the placeId from a selected autocomplete suggestion —
      // it's exact and unambiguous. Fall back to countryCode+cityName
      // only if the user typed a destination without picking a
      // suggestion (LiteAPI's docs note this fallback needs an exact
      // string match and can return zero results for larger cities).
      // Look up more hotels than we price (60 vs 15) so the 15 we price can
      // be a real mix of star levels — that's what makes the Stars filter
      // useful. Pricing is the slow/costly step; the lookup is cheap.
      const lookupParams = place
        ? new URLSearchParams({ placeId: place.placeId, limit: "60" })
        : new URLSearchParams({
            // Puerto Rico has its own country code for hotels: "San Juan"
            // (or "San Juan, PR") looks there, not in the 50 states.
            countryCode: /,\s*(PR|Puerto Rico)\b/i.test(qCity) ||
              searchAirports(qCity.split(",")[0].trim()).results.some(
                (a) => a.state === "PR" && a.city.toLowerCase() === qCity.split(",")[0].trim().toLowerCase()
              )
              ? "PR"
              : countryCode,
            cityName: qCity.split(",")[0].trim(),
            limit: "60",
          });

      let hotelsFound;
      if (pinned) {
        hotelsFound = [
          {
            id: pinned.hotelId,
            name: pinned.name,
            main_photo: pinned.thumbnail,
            address: pinned.address,
            stars: pinned.stars,
            rating: pinned.rating,
          },
        ];
      } else {
        const lookupRes = await fetch(
          `${API}/api/hotels/lookup?${lookupParams}`
        );
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.ok)
          throw new Error(
            lookupData.message || "Couldn't find that destination"
          );
        hotelsFound = lookupData.hotels ?? [];
      }
      if (!hotelsFound.length) {
        antdMessage.info(
          place
            ? "No hotels found for that destination."
            : "No hotels found. Pick your city from the list."
        );
        onSearch([]);
        return;
      }

      // Limit how many hotels we price-check at once — keeps the
      // rates call fast. Adjust this cap as your UI/UX needs grow.
      const hotelIds = pickHotelMix(hotelsFound, 15).map((h) => h.id);

      // ── Step 2: get live rates for those hotels ──
      const searchParams = new URLSearchParams({
        hotelIds: hotelIds.join(","),
        checkin: dayjs(qDates[0].toDate()).format("YYYY-MM-DD"),
        checkout: dayjs(qDates[1].toDate()).format("YYYY-MM-DD"),
        adults: String(qAdults),
        rooms: String(qRooms),
      });
      // Middle of the hotels found, so the server can also check Duffel
      // Stays around the same spot (ignored when Duffel Stays is off).
      const pts = hotelsFound
        .map((h) => [Number(h.latitude), Number(h.longitude)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && (a || b));
      if (pts.length && !pinned) {
        searchParams.set(
          "lat",
          String(pts.reduce((s, p) => s + p[0], 0) / pts.length)
        );
        searchParams.set(
          "lng",
          String(pts.reduce((s, p) => s + p[1], 0) / pts.length)
        );
      }
      const searchRes = await fetch(`${API}/api/hotels/search?${searchParams}`);
      const searchData = await searchRes.json();
      if (!searchRes.ok || !searchData.ok)
        throw new Error(searchData.message || "Hotel search failed");

      // Merge metadata (name, photo, stars) from the lookup step
      // with pricing/offer data from the search step, keyed by hotelId
      const metaById = Object.fromEntries(hotelsFound.map((h) => [h.id, h]));
      // (Duffel Stays results arrive with their own name, photo and stars.)
      const enriched = (searchData.hotels ?? []).map((offer) => ({
        ...offer,
        name: metaById[offer.hotelId]?.name ?? offer.name ?? "Hotel",
        thumbnail:
          metaById[offer.hotelId]?.main_photo ?? offer.thumbnail ?? null,
        stars: metaById[offer.hotelId]?.stars ?? offer.stars ?? null,
        rating: metaById[offer.hotelId]?.rating ?? offer.rating ?? null,
        address: metaById[offer.hotelId]?.address ?? offer.address ?? "",
      }));

      // Attach the search dates to every result so HotelCheckout
      // can show real check-in/check-out instead of "Dates TBD"
      const checkinISO = dayjs(qDates[0].toDate()).format("YYYY-MM-DD");
      const checkoutISO = dayjs(qDates[1].toDate()).format("YYYY-MM-DD");
      const withDates = enriched.map((h) => ({
        ...h,
        checkin: checkinISO,
        checkout: checkoutISO,
        // Guests each room was priced for — Sync Together shared rooms
        // check this against how many people are sharing.
        adults: qRooms > 1 ? Math.floor(qAdults / qRooms) : qAdults,
      }));

      onSearch(withDates);
      // Short name for headings/weather ("Miami Beach", not the full region line).
      onDestChange?.(pinned ? pinned.name : place?.displayName || qCity.trim());
      antdMessage.success(`Found ${withDates.length} room options`);

      if (!pinned && withDates.length > 0) {
        setRecentStays(
          saveRecentStay({
            city: place?.displayName || qCity.trim(),
            placeId: place?.placeId || null,
            secondaryText: place?.secondaryText || "",
            countryCode,
            checkin: checkinISO,
            checkout: checkoutISO,
            adults: qAdults,
            rooms: qRooms,
          })
        );
      }
    } catch (err) {
      antdMessage.error(err.message || "Hotel search failed");
    } finally {
      setLoading(false);
      onSearchEnd?.();
    }
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-pass">
        <div
          className={`sk-pass-seg sk-pass-seg--where${
            suggestOpen || quickMenuOpen ? " is-active" : ""
          }`}
          ref={cityFieldRef}
          onClick={() => cityInputRef.current?.focus()}
        >
          <label className="sk-pass-label" htmlFor="sk-where-input">
            <MapPin size={12} aria-hidden="true" /> Where
          </label>
          <div className="sk-where-box">
            <input
              id="sk-where-input"
              ref={cityInputRef}
              className="sk-where-input"
              placeholder="Where to?"
              value={cityName}
              onChange={handleCityInputChange}
              onKeyDown={handleCityInputKeyDown}
              onFocus={() => {
                if (!cityName.trim()) setQuickMenuOpen(true);
                else if (suggestions.length > 0 && !selectedPlace)
                  setSuggestOpen(true);
              }}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={suggestOpen || quickMenuOpen}
              aria-controls="sk-where-menu"
              aria-autocomplete="list"
              aria-label="Where to? City, landmark or hotel"
            />
            {cityName && (
              <button
                type="button"
                className="sk-where-clear"
                onClick={clearCity}
                aria-label="Clear destination"
              >
                <CloseOutlined />
              </button>
            )}
          </div>

          {/* Typing: live place suggestions */}
          {suggestOpen && (
            <div className="sk-where-menu" id="sk-where-menu" role="listbox">
              {suggestLoading && suggestions.length === 0 && (
                <div className="sk-where-status">
                  <LoadingOutlined /> Searching places…
                </div>
              )}
              {suggestions.map((s, i) => {
                const kind = placeKind(s.types);
                return (
                  <button
                    type="button"
                    key={s.placeId}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    className={`sk-where-item${
                      i === highlightedIndex ? " is-highlighted" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPlaceSuggestion(s)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                  >
                    <span className="sk-where-icon">
                      <PlaceKindIcon kind={kind} />
                    </span>
                    <span className="sk-where-text">
                      <span className="sk-where-name">{s.displayName}</span>
                      {s.secondaryText && (
                        <span className="sk-where-sub">{s.secondaryText}</span>
                      )}
                    </span>
                    {i === highlightedIndex && (
                      <span className="sk-where-xp">
                        <Zap size={11} /> {STAY_BOOKING_XP} XP
                      </span>
                    )}
                  </button>
                );
              })}
              {!suggestLoading && suggestions.length === 0 && (
                <div className="sk-where-status">
                  No places match &quot;{cityName}&quot;. Try a city, neighborhood or
                  hotel name.
                </div>
              )}
            </div>
          )}

          {/* Empty box: recent searches + popular destinations */}
          {quickMenuOpen && !suggestOpen && !cityName.trim() && (
            <div className="sk-where-menu" id="sk-where-menu">
              {recentStays.length > 0 && (
                <>
                  <div className="sk-where-heading">Recent searches</div>
                  {recentStays.map((r) => (
                    <button
                      type="button"
                      key={`${r.placeId || r.city}-${r.checkin}`}
                      className="sk-where-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickRecent(r)}
                    >
                      <span className="sk-where-icon">
                        <PlaceKindIcon kind="recent" />
                      </span>
                      <span className="sk-where-text">
                        <span className="sk-where-name">{r.city}</span>
                        <span className="sk-where-sub">
                          {dayjs(r.checkin).format("MMM D")} –{" "}
                          {dayjs(r.checkout).format("MMM D")} · {r.adults}{" "}
                          traveler{r.adults !== 1 ? "s" : ""}, {r.rooms} room
                          {r.rooms !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              <div className="sk-where-heading">Popular destinations</div>
              {POPULAR_STAYS.map((p) => (
                <button
                  type="button"
                  key={p.city}
                  className="sk-where-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickPopular(p)}
                >
                  <span className="sk-where-icon">
                    <PlaceKindIcon kind="city" />
                  </span>
                  <span className="sk-where-text">
                    <span className="sk-where-name">{p.city}</span>
                    <span className="sk-where-sub">
                      {STAY_COUNTRIES.find(([cc]) => cc === p.country)?.[1] ??
                        p.country}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sk-pass-seg sk-pass-seg--when">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            {dates[0] && dates[1] && (
              <span className="sk-pass-nights">
                · {dates[1].diff(dates[0], "day")} night
                {dates[1].diff(dates[0], "day") !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Check-in", "Check-out"]}
            value={dates}
            onChange={handleDatesChange}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <GuestsRoomsPicker
            adults={adults}
            rooms={numRooms}
            maxRooms={MAX_ROOMS_PER_TRIP}
            onChange={({ adults: a, rooms: r }) => {
              setAdults(a);
              setNumRooms(r);
            }}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={() => handleSearch()}
          disabled={loading}
          aria-label="Search stays"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Search"}
          </span>
        </button>
      </div>

      {/* ── Date shortcuts ── */}
      <div className="sk-stay-shortcuts">
        <div className="sk-stay-shortcut-row">
          <span className="sk-stay-shortcut-label">Dates</span>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => handleDatesChange(weekendRange(0))}
          >
            This weekend
          </button>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => handleDatesChange(weekendRange(1))}
          >
            Next weekend
          </button>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => {
              const start =
                dates[0] && !dates[0].isBefore(dayjs(), "day")
                  ? dates[0]
                  : dayjs().add(14, "day").startOf("day");
              handleDatesChange([start, start.add(7, "day")]);
            }}
          >
            1 week
          </button>
        </div>
      </div>
    </div>
  );
}
