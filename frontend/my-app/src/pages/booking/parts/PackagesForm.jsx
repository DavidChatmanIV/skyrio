// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect, useRef } from "react";
import { message as antdMessage } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import AirportInput from "@/pages/booking/AirportInput";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import { fetchHomeAirport } from "@/lib/homeAirport";
import { Plane as PlaneIcon, MapPin, Calendar, Users, Home as HomeIcon } from "lucide-react";
import { IconHotel, IconFlight, MAX_ROOMS_PER_TRIP, airportLabel, GuestsRoomsPicker } from "./shared";
import { signedInHome } from "./lastSearch";

// Flight + Stay. There's no bundled package rate, so this runs the real
// searches in order: the flight first, then the stay at the destination.
export function PackagesForm({ onDestChange, onDatesChange, onHandoff }) {
  // From starts on the traveler's home airport, same as Flights.
  const [homeAirport, setHomeAirport] = useState(signedInHome);
  const [origin, setOrigin] = useState(() => signedInHome() || null);
  const [originDisplay, setOriginDisplay] = useState(() =>
    airportLabel(signedInHome())
  );
  // New device: nothing saved in this browser, so ask the account.
  const originRef = useRef(origin);
  originRef.current = origin;
  useEffect(() => {
    if (homeAirport) return;
    let alive = true;
    fetchHomeAirport().then(({ homeAirport: ap }) => {
      if (!alive || !ap) return;
      setHomeAirport(ap);
      if (!originRef.current) {
        setOrigin(ap);
        setOriginDisplay(airportLabel(ap));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isHomeOrigin =
    !!origin?.code &&
    origin.code.toUpperCase() === homeAirport?.code?.toUpperCase();
  const [dest, setDest] = useState(null);
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);

  const handleDates = (v) => {
    const nd = v ?? [null, null];
    setDates(nd);
    onDatesChange?.({
      dates: nd,
      nights: nd[0] && nd[1] ? nd[1].diff(nd[0], "day") : null,
    });
  };

  const handleSearch = () => {
    if (!origin) return antdMessage.warning("Where are you leaving from?");
    if (!dest) return antdMessage.warning("Where are you going?");
    if (!dates[0] || !dates[1])
      return antdMessage.warning("Pick your travel dates");
    const depart = dates[0].format("YYYY-MM-DD");
    const ret = dates[1].format("YYYY-MM-DD");
    onHandoff?.({
      tab: "Flights",
      // Names travel with the codes so the flight step reads
      // "Newark (EWR) → Las Vegas (LAS)", not "EWR (EWR)".
      params: {
        from: origin.code,
        fromName: origin.city,
        to: dest.code,
        toName: dest.city,
        depart,
        return: ret,
        adults,
      },
      plan: {
        city: dest.city,
        code: dest.code,
        from: origin.code,
        fromName: origin.city,
        depart,
        ret,
        adults,
        rooms,
        flight: null, // filled in when a flight is picked
      },
    });
  };

  const nights = dates[0] && dates[1] ? dates[1].diff(dates[0], "day") : null;

  return (
    <div className="sk-search-bar">
      <div className="sk-pkg-steps" aria-label="How packages work">
        <span className="sk-pkg-step">
          <IconFlight size={12} /> 1 · Flight
        </span>
        <span className="sk-pkg-step-line" aria-hidden="true" />
        <span className="sk-pkg-step">
          <IconHotel size={12} /> 2 · Stay
        </span>
        <span className="sk-pkg-step-note">Earn XP on both bookings</span>
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
            {isHomeOrigin && (
              <span className="sk-home-tag" title="Your home airport">
                <HomeIcon size={10} aria-hidden="true" /> Home
              </span>
            )}
          </span>
          <AirportInput
            value={originDisplay}
            placeholder="Leaving from"
            onChange={(ap) => {
              setOrigin(ap);
              setOriginDisplay(airportLabel(ap));
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="Going to"
            onChange={(ap) => {
              setDest(ap);
              setDestDisplay(airportLabel(ap));
              onDestChange?.(ap.city);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            {nights > 0 && (
              <span className="sk-pass-nights">
                · {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            value={dates}
            onChange={handleDates}
            placeholder={["Depart", "Return"]}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <GuestsRoomsPicker
            adults={adults}
            rooms={rooms}
            maxRooms={MAX_ROOMS_PER_TRIP}
            onChange={({ adults: a, rooms: r }) => {
              setAdults(Math.min(a, 9)); // flights allow up to 9 travelers
              setRooms(r);
            }}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={handleSearch}
          aria-label="Start your package"
        >
          <SearchOutlined />
          <span className="sk-pass-go-text">Find flight + stay</span>
        </button>
      </div>
    </div>
  );
}
