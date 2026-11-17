// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useCallback, useEffect, useRef } from "react";
import { DatePicker, Select, InputNumber, message as antdMessage } from "antd";
import { SearchOutlined, LoadingOutlined, SwapOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import AirportInput from "@/pages/booking/AirportInput";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import { readHomeAirport, fetchHomeAirport, saveHomeAirport } from "@/lib/homeAirport";
import { Plane as PlaneIcon, MapPin, Calendar, Users, Home as HomeIcon } from "lucide-react";
import { API, IconWarning, SearchBtn, airportLabel, TravelersCabinPicker, Option } from "./shared";
import { signedInHome } from "./lastSearch";

export const BOOKING_TRIP_TYPES = [
  { key: "roundtrip", label: "Round trip" },
  { key: "oneway", label: "One way" },
  { key: "multi-city", label: "Multi-city" },
];

export function TripTypeToggle({ value, onChange }) {
  return (
    <div className="sk-trip-type">
      {BOOKING_TRIP_TYPES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`sk-trip-type-btn${value === key ? " is-active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const EMPTY_LEG = () => ({
  id: Date.now() + Math.random(),
  origin: null,
  originDisplay: "",
  dest: null,
  destDisplay: "",
  date: null,
});

export function MultiCityForm({ onDestChange, onDatesChange }) {
  const [legs, setLegs] = useState([EMPTY_LEG(), EMPTY_LEG()]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);

  const updateLeg = (index, patch) =>
    setLegs((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  const addLeg = () => {
    if (legs.length >= 6)
      return antdMessage.info("Maximum 6 flights for multi-city");
    setLegs((prev) => [...prev, EMPTY_LEG()]);
  };
  const removeLeg = (index) => {
    if (legs.length <= 2)
      return antdMessage.info("At least 2 flights required");
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const lastDest = [...legs].reverse().find((l) => l.dest?.city);
    if (lastDest) onDestChange?.(lastDest.dest.city);
  }, [legs, onDestChange]);

  const handleSearch = async () => {
    const incomplete = legs.find((l) => !l.origin || !l.dest || !l.date);
    if (incomplete)
      return antdMessage.warning("Please fill in all flights before searching");
    setLoading(true);
    try {
      const results = await Promise.all(
        legs.map((leg) => {
          const params = new URLSearchParams({
            from: leg.origin.code,
            to: leg.dest.code,
            departDate: dayjs(leg.date.toDate()).format("YYYY-MM-DD"),
            adults: String(adults),
            cabin,
          });
          return fetch(`${API}/api/flights/search?${params}`)
            .then((r) => r.json())
            .then((data) => {
              if (!data.ok) throw new Error(data.message || "Search failed");
              return data.flights ?? [];
            });
        })
      );
      antdMessage.success(
        `Found ${results.flat().length} options across ${legs.length} flights`
      );
    } catch (err) {
      antdMessage.error(err.message || "Multi-city search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sk-search-bar sk-multicity-bar">
      <div className="sk-mc-legs">
        {legs.map((leg, index) => (
          <div key={leg.id} className="sk-mc-leg">
            <div className="sk-mc-leg-badge">
              <span className="sk-mc-leg-num">{index + 1}</span>
              {index < legs.length - 1 && <div className="sk-mc-leg-line" />}
            </div>
            <div className="sk-mc-leg-fields">
              <div className="sk-mc-field-row">
                <div className="sk-mc-field">
                  <span className="sk-mc-field-label">From</span>
                  <AirportInput
                    value={leg.originDisplay}
                    placeholder="City or airport"
                    onChange={(ap) =>
                      updateLeg(index, {
                        origin: ap,
                        originDisplay: `${ap.city} (${ap.code})`,
                      })
                    }
                  />
                </div>
                <div className="sk-mc-arrow" aria-hidden="true">
                  →
                </div>
                <div className="sk-mc-field">
                  <span className="sk-mc-field-label">To</span>
                  <AirportInput
                    value={leg.destDisplay}
                    placeholder="City or airport"
                    onChange={(ap) => {
                      updateLeg(index, {
                        dest: ap,
                        destDisplay: `${ap.city} (${ap.code})`,
                      });
                      if (index < legs.length - 1) {
                        setLegs((prev) =>
                          prev.map((l, i) =>
                            i === index + 1 && !l.origin
                              ? {
                                  ...l,
                                  origin: ap,
                                  originDisplay: `${ap.city} (${ap.code})`,
                                }
                              : l
                          )
                        );
                      }
                    }}
                  />
                </div>
                <div className="sk-mc-field sk-mc-field--date">
                  <span className="sk-mc-field-label">Date</span>
                  <DatePicker
                    className="sk-orange-picker sk-mc-datepicker"
                    placeholder="Depart"
                    value={leg.date}
                    disabledDate={(d) => {
                      if (!d) return false;
                      if (d.isBefore(dayjs(), "day")) return true;
                      if (index > 0 && legs[index - 1].date)
                        return d.isBefore(legs[index - 1].date, "day");
                      return false;
                    }}
                    onChange={(date) => updateLeg(index, { date })}
                  />
                </div>
                {legs.length > 2 && (
                  <button
                    type="button"
                    className="sk-mc-remove-btn"
                    onClick={() => removeLeg(index)}
                    aria-label={`Remove flight ${index + 1}`}
                  >
                    <CloseOutlined />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="sk-mc-controls">
        <button
          type="button"
          className="sk-mc-add-btn"
          onClick={addLeg}
          disabled={legs.length >= 6}
        >
          <span className="sk-mc-add-icon">+</span>Add flight
        </button>
        <div className="sk-mc-right">
          <Select
            className="sk-select-cabin"
            value={cabin}
            onChange={setCabin}
            classNames={{ popup: { root: "sk-select-popup" } }}
          >
            <Option value="economy">Economy</Option>
            <Option value="premium_economy">Premium Economy</Option>
            <Option value="business">Business</Option>
            <Option value="first">First Class</Option>
          </Select>
          <InputNumber
            className="sk-input-travelers"
            min={1}
            max={9}
            value={adults}
            onChange={(v) => setAdults(v ?? 1)}
            placeholder="Travelers"
          />
          <SearchBtn onClick={handleSearch} loading={loading} />
        </div>
      </div>
    </div>
  );
}

// "Las Vegas (LAS)" — or just "LAS" when we only know the code, never
// "LAS (LAS)".
// Turns text someone typed without picking a suggestion ("miami", "MIA")
// into an airport, using the same lookup as the suggestions. null if
// nothing matches.
export async function findAirport(text) {
  const q = String(text || "").trim();
  if (q.length < 2) return null;
  try {
    const res = await fetch(`${API}/api/airports?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const list = Array.isArray(data)
      ? data
      : data?.airports || data?.data || data?.results || [];
    const norm = (a) => {
      const code = a?.code || a?.iata || a?.iataCode || a?.iata_code;
      return code
        ? {
            ...a,
            code: String(code).toUpperCase(),
            city: a.city || a.cityName || a.city_name || a.name || code,
          }
        : null;
    };
    const airports = list.map(norm).filter(Boolean);
    const exact = airports.find((a) => a.code === q.toUpperCase());
    return exact || airports[0] || null;
  } catch {
    return null;
  }
}

export function FlightsForm({
  onSearch,
  onDestChange,
  onDatesChange,
  onOriginChange,
  onSearchStart,
  onSearchEnd,
  onSearchError,
  retryRef,
  initial = null,
  // Tells the page what's still missing, so the boarding pass never says
  // "Ready — hit search" while a box is empty.
  onReadyChange,
}) {
  // From starts on a signed-in traveler's home airport, unless the link says
  // where to fly from. Guests start empty. They can always change it.
  const [homeAirport, setHomeAirport] = useState(signedInHome);
  const startFromHome = !initial?.from && homeAirport ? homeAirport : null;
  const [originAirport, setOriginAirport] = useState(startFromHome);
  const [destAirport, setDestAirport] = useState(null);
  const [originDisplay, setOriginDisplay] = useState(
    startFromHome ? `${startFromHome.city} (${startFromHome.code})` : ""
  );
  // Fill the boarding pass's FROM with the home city right away.
  useEffect(() => {
    if (startFromHome) onOriginChange?.(startFromHome.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // New device: nothing saved in this browser yet, so ask the account
  // (Digital Passport). Only fills From if it's still empty.
  const originRef = useRef(originAirport);
  originRef.current = originAirport;
  useEffect(() => {
    if (homeAirport || initial?.from) return;
    let alive = true;
    fetchHomeAirport().then(({ homeAirport: ap }) => {
      if (!alive || !ap) return;
      setHomeAirport(ap);
      if (!originRef.current) {
        setOriginAirport(ap);
        setOriginDisplay(`${ap.city} (${ap.code})`);
        onOriginChange?.(ap.city);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isHomeOrigin =
    !!originAirport?.code &&
    originAirport.code.toUpperCase() === homeAirport?.code;
  const makeHome = async () => {
    const { homeAirport: saved, synced } = await saveHomeAirport(originAirport);
    if (!saved) return;
    setHomeAirport(saved);
    antdMessage.success(
      synced
        ? `${saved.city} (${saved.code}) is now your home airport`
        : `${saved.city} (${saved.code}) saved as home on this device`
    );
  };
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tripType, setTripType] = useState("roundtrip");
  // What's typed in From / To right now. Typing without picking a
  // suggestion used to be ignored, so Search looked like it did nothing.
  const [originText, setOriginText] = useState(
    startFromHome ? `${startFromHome.city} (${startFromHome.code})` : ""
  );
  const [destText, setDestText] = useState("");
  // Shown right under the pass (a toast at the top was easy to miss).
  const [formError, setFormError] = useState("");

  // Typing in a box drops the airport that was picked before, so the
  // pass and the search use what's actually in the box.
  // (Reported by AirportInput's onTextChange. An onInputCapture wrapper
  // used to do this and made the boxes drop keystrokes.)
  const typedIn = (which) => (v) => {
    if (typeof v !== "string") return;
    setFormError("");
    if (which === "from") {
      setOriginText(v);
      if (originAirport && v !== originDisplay) {
        setOriginAirport(null);
        onOriginChange?.("");
      }
    } else {
      setDestText(v);
      if (destAirport && v !== destDisplay) {
        setDestAirport(null);
        onDestChange?.("");
      }
    }
  };

  // What's still missing, in plain words.
  const missing = [
    !originAirport && !originText.trim() ? "where you're flying from" : null,
    !destAirport && !destText.trim() ? "where you're going" : null,
    !dates[0]
      ? "your dates"
      : tripType === "roundtrip" && !dates[1]
      ? "a return date"
      : null,
  ].filter(Boolean);
  const missingKey = missing.join("|");
  useEffect(() => {
    onReadyChange?.(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  const handleDatesChange = useCallback(
    (v) => {
      const newDates = v ?? [null, null];
      setDates(newDates);
      setFormError("");
      if (newDates[0] && newDates[1]) {
        onDatesChange?.({
          dates: newDates,
          nights: newDates[1].diff(newDates[0], "day"),
        });
      } else {
        onDatesChange?.({ dates: newDates, nights: null });
      }
    },
    [onDatesChange]
  );

  // ── Prefill from the link (e.g. a Sync Together trip): from/to airport
  // codes or a city name, and dates. Runs once; the traveler can change
  // anything before searching.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || prefilledRef.current) return;
    prefilledRef.current = true;
    const asAirport = (a, fallback) => {
      const code = a?.code || a?.iata || a?.iataCode || a?.iata_code;
      if (!code) return null;
      return {
        ...a,
        code,
        city: a.city || a.cityName || a.city_name || a.name || fallback || code,
      };
    };
    const lookup = async (q, name) => {
      if (!q) return null;
      if (/^[A-Za-z]{3}$/.test(q.trim())) {
        const code = q.trim().toUpperCase();
        // "New Orleans, LA" → "New Orleans".
        const named = String(name || "")
          .split(",")[0]
          .trim();
        if (named) return { code, city: named };
        // Link only gave a code. The home airport already has its name…
        const home = readHomeAirport();
        if (home?.code?.toUpperCase() === code) return { ...home, code };
        // …otherwise look the code up so it reads "Las Vegas (LAS)",
        // not "LAS (LAS)".
        try {
          const res = await fetch(
            `${API}/api/airports?q=${encodeURIComponent(code)}`
          );
          const data = await res.json();
          const list = Array.isArray(data)
            ? data
            : data?.airports || data?.data || data?.results || [];
          const match = list
            .map((a) => asAirport(a, code))
            .find((a) => a?.code?.toUpperCase() === code);
          if (match) return { ...match, code };
        } catch {
          /* fall through to the code alone */
        }
        return { code, city: code };
      }
      try {
        const res = await fetch(
          `${API}/api/airports?q=${encodeURIComponent(q.trim())}`
        );
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data?.airports || data?.data || data?.results || [];
        return asAirport(list[0], q.trim());
      } catch {
        return null;
      }
    };
    (async () => {
      const [o, d] = await Promise.all([
        lookup(initial.from, initial.fromName),
        lookup(initial.to, initial.toName),
      ]);
      if (o) {
        setOriginAirport(o);
        setOriginDisplay(airportLabel(o));
        onOriginChange?.(o.city);
      }
      if (d) {
        setDestAirport(d);
        setDestDisplay(airportLabel(d));
        onDestChange?.(d.city);
      }
      // From the trip page: run the search right away.
      const depart = initial.depart ? dayjs(initial.depart) : null;
      if (initial.autoSearch && o && d && depart?.isValid()) {
        const q = new URLSearchParams({
          from: o.code,
          to: d.code,
          departDate: depart.format("YYYY-MM-DD"),
          // Flights allow up to 9 travelers per booking — match the form's cap.
          adults: String(Math.min(9, Number(initial.adults) || 1)),
          cabin: initial.cabin || "economy",
        });
        if (Number(initial.adults) >= 1)
          setAdults(Math.min(9, Number(initial.adults)));
        const back = initial.ret ? dayjs(initial.ret) : null;
        if (back?.isValid()) q.set("returnDate", back.format("YYYY-MM-DD"));
        if (initial.cabin) setCabin(initial.cabin);
        runFlightSearch(q.toString());
      }
    })();
    const start = initial.depart ? dayjs(initial.depart) : null;
    const end = initial.ret ? dayjs(initial.ret) : null;
    if (start?.isValid()) {
      handleDatesChange([start, end?.isValid() ? end : null]);
      if (!end?.isValid()) setTripType("oneway");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Remember the last search so "Try again" can re-run it exactly, without
  // the customer having to re-enter anything.
  const lastQueryRef = useRef(null);

  const runFlightSearch = async (query) => {
    lastQueryRef.current = query;
    setLoading(true);
    onSearchError?.(null);
    onSearchStart?.();

    try {
      const res = await fetch(`${API}/api/flights/search?${query}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Flight search failed");
      }

      const searched = Object.fromEntries(new URLSearchParams(query));
      // Each fare is priced for exactly this many travelers. Checkout uses
      // it to start with the right number of traveler forms; a different
      // count made the airline reject the booking.
      const pricedFor = {
        adults: Math.max(1, Number(searched.adults) || 1),
        children: Math.max(0, Number(searched.children) || 0),
      };
      const flights = (data.flights ?? []).map((f) => ({ ...f, pricedFor }));
      // Second argument: what was searched (adults, cabin…) so Price Watch
      // re-checks the same kind of search.
      onSearch(flights, searched);

      // The airline's system failed, so the server returned this exact
      // search from a few minutes ago. Say so plainly.
      if (data.stale) {
        antdMessage.info(
          "Prices from a few minutes ago. Confirmed before you pay."
        );
      }

      if (flights.length === 0) {
        antdMessage.info("No flights found. Try other dates.");
      } else {
        // No number here: the list below counts departure options, which
        // is different from the raw fare count (testers saw 297 vs 27).
        antdMessage.success("Flights found");
      }
    } catch (err) {
      onSearch([]);
      onSearchError?.(err.message || "Flight search failed");
    } finally {
      setLoading(false);
      onSearchEnd?.();
    }
  };

  // Lets BookingPage's "Try again" button re-run the last search.
  useEffect(() => {
    if (!retryRef) return;
    retryRef.current = () => {
      if (lastQueryRef.current) runFlightSearch(lastQueryRef.current);
    };
  });

  const handleSearch = async () => {
    const fail = (msg) => {
      setFormError(msg);
      antdMessage.warning(msg);
    };
    setFormError("");
    let from = originAirport;
    let to = destAirport;

    // Typed but not picked from the list? Look it up instead of ignoring it.
    if ((!from && originText.trim()) || (!to && destText.trim())) {
      setLoading(true);
      const [o, d] = await Promise.all([
        !from && originText.trim() ? findAirport(originText) : null,
        !to && destText.trim() ? findAirport(destText) : null,
      ]);
      setLoading(false);
      if (o) {
        from = o;
        setOriginAirport(o);
        setOriginDisplay(airportLabel(o));
        setOriginText(airportLabel(o));
        onOriginChange?.(o.city);
      }
      if (d) {
        to = d;
        setDestAirport(d);
        setDestDisplay(airportLabel(d));
        setDestText(airportLabel(d));
        onDestChange?.(d.city);
      }
      if (o || d) {
        antdMessage.info(
          `Searching ${[o && airportLabel(o), d && airportLabel(d)]
            .filter(Boolean)
            .join(" and ")}. Change it if that's not the one you meant.`
        );
      }
    }

    if (!from)
      return fail(
        originText.trim()
          ? `We couldn't find an airport for "${originText.trim()}". Pick one from the list.`
          : "Add where you're flying from."
      );
    if (!to)
      return fail(
        destText.trim()
          ? `We couldn't find an airport for "${destText.trim()}". Pick one from the list.`
          : "Add where you're going."
      );
    if (from.code === to.code)
      return fail("From and To are the same airport. Pick a different one.");
    if (!dates[0]) return fail("Pick your travel dates.");
    if (tripType === "roundtrip" && !dates[1])
      return fail("Pick a return date, or switch to One way.");

    const params = new URLSearchParams({
      from: from.code,
      to: to.code,
      departDate: dayjs(dates[0].toDate()).format("YYYY-MM-DD"),
      adults: String(adults),
      cabin,
    });
    if (tripType === "roundtrip" && dates[1]) {
      params.set("returnDate", dayjs(dates[1].toDate()).format("YYYY-MM-DD"));
    }

    runFlightSearch(params.toString());
  };

  const handleSwap = () => {
    const prevOrigin = originAirport;
    const prevDest = destAirport;
    setOriginAirport(prevDest);
    setDestAirport(prevOrigin);
    setOriginDisplay(destDisplay);
    setDestDisplay(originDisplay);
    setOriginText(destText);
    setDestText(originText);
    setFormError("");
    if (prevDest?.city) onOriginChange?.(prevDest.city);
    if (prevOrigin?.city) onDestChange?.(prevOrigin.city);
  };

  if (tripType === "multi-city") {
    return (
      <div className="sk-search-bar">
        <div className="sk-trip-type-row">
          <TripTypeToggle value={tripType} onChange={setTripType} />
        </div>
        <MultiCityForm
          onDestChange={onDestChange}
          onDatesChange={onDatesChange}
        />
      </div>
    );
  }

  return (
    <div className="sk-search-bar">
      <div className="sk-trip-type-row">
        <TripTypeToggle value={tripType} onChange={setTripType} />
      </div>
      <div className="sk-pass sk-pass--flights">
        <div className="sk-pass-seg sk-pass-seg--from sk-pass-flat">
          <span className="sk-pass-label">
            <PlaneIcon
              size={12}
              aria-hidden="true"
              style={{ transform: "rotate(45deg)" }}
            />{" "}
            From
            {isHomeOrigin ? (
              <span className="sk-home-tag" title="Your home airport">
                <HomeIcon size={10} aria-hidden="true" /> Home
              </span>
            ) : originAirport?.code ? (
              <button
                type="button"
                className="sk-home-save"
                onClick={makeHome}
                title={`Start every flight search from ${originAirport.city}`}
              >
                <HomeIcon size={10} aria-hidden="true" /> Make home
              </button>
            ) : null}
          </span>
          <AirportInput
            value={originDisplay}
            onTextChange={typedIn("from")}
            placeholder="City or airport"
            onChange={(ap) => {
              setOriginAirport(ap);
              setOriginDisplay(`${ap.city} (${ap.code})`);
              setOriginText(`${ap.city} (${ap.code})`);
              setFormError("");
              onOriginChange?.(ap.city);
            }}
          />
        </div>

        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <button
            type="button"
            className="sk-pass-swap"
            onClick={handleSwap}
            aria-label="Swap departure and destination"
            title="Swap"
          >
            <SwapOutlined />
          </button>
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            onTextChange={typedIn("to")}
            placeholder="City or airport"
            onChange={(ap) => {
              setDestAirport(ap);
              setDestDisplay(`${ap.city} (${ap.code})`);
              setDestText(`${ap.city} (${ap.code})`);
              setFormError("");
              onDestChange?.(ap.city);
            }}
          />
        </div>

        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" />
            {/* Short label: "Depart → Return · 4 nights" ran into "Who". */}
            {tripType === "roundtrip" ? "When" : "Depart"}
            {tripType === "roundtrip" && dates[0] && dates[1] && (
              <span className="sk-pass-nights">
                · {dates[1].diff(dates[0], "day")} night
                {dates[1].diff(dates[0], "day") !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          {tripType === "roundtrip" ? (
            <SkyrioPicker
              className="sk-orange-picker"
              value={dates}
              onChange={handleDatesChange}
              placeholder={["Depart", "Return"]}
              disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
            />
          ) : (
            <DatePicker
              className="sk-orange-picker"
              placeholder="Departure date"
              value={dates[0]}
              format="ddd, MMM D"
              disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
              onChange={(date) => {
                const nd = [date, null];
                setDates(nd);
                onDatesChange?.({ dates: nd, nights: null });
              }}
            />
          )}
        </div>

        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <TravelersCabinPicker
            adults={adults}
            cabin={cabin}
            onChange={({ adults: a, cabin: c }) => {
              setAdults(a);
              setCabin(c);
            }}
          />
        </div>

        <button
          type="button"
          className="sk-pass-go"
          onClick={handleSearch}
          disabled={loading}
          aria-label="Search flights"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Search flights"}
          </span>
        </button>
      </div>
      {formError && (
        <div
          role="alert"
          className="sk-pass-error"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.35)",
            color: "#fecaca",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <IconWarning size={14} /> {formError}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stays search helpers
// ─────────────────────────────────────────────
