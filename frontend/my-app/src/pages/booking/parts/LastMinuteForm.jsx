// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState } from "react";
import { message as antdMessage } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import AirportInput from "@/pages/booking/AirportInput";
import { Plane as PlaneIcon, MapPin, Clock, Users } from "lucide-react";
import { TravelersCabinPicker, weekendRange } from "./shared";

// Curated quick picks for "where should I go?" — each is a real airport,
// so tapping one fills TO and the search is a normal live flight search.
export const LAST_MINUTE_IDEAS = [
  { vibe: "Beach", city: "Miami", code: "MIA" },
  { vibe: "Beach", city: "Cancún", code: "CUN" },
  { vibe: "City", city: "New York", code: "JFK" },
  { vibe: "Parks", city: "Orlando", code: "MCO" },
  { vibe: "Mountains", city: "Denver", code: "DEN" },
];

export function LastMinuteForm({ onHandoff }) {
  const [when, setWhen] = useState("this"); // "this" | "next" weekend
  const [origin, setOrigin] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [dest, setDest] = useState(null);
  const [destDisplay, setDestDisplay] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState("economy");

  const range = weekendRange(when === "this" ? 0 : 1);

  const handleSearch = () => {
    if (!origin) return antdMessage.warning("Where are you leaving from?");
    if (!dest)
      return antdMessage.warning("Pick a destination — or tap an idea below");
    onHandoff?.({
      tab: "Flights",
      params: {
        from: origin.code,
        to: dest.code,
        depart: range[0].format("YYYY-MM-DD"),
        return: range[1].format("YYYY-MM-DD"),
        adults,
        cabin,
      },
    });
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-trip-type-row">
        <div
          className="sk-trip-type"
          role="radiogroup"
          aria-label="Which weekend"
        >
          {[
            ["this", "This weekend"],
            ["next", "Next weekend"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={when === key}
              className={`sk-trip-type-btn${when === key ? " is-active" : ""}`}
              onClick={() => setWhen(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="sk-pass sk-pass--flights">
        <div className="sk-pass-seg sk-pass-seg--leaving">
          <span className="sk-pass-label">
            <Clock size={12} aria-hidden="true" /> Leaving
            <span className="sk-pass-nights">
              · {range[1].diff(range[0], "day")} night
              {range[1].diff(range[0], "day") !== 1 ? "s" : ""}
            </span>
          </span>
          <span className="sk-pass-value">
            {range[0].format("ddd, MMM D")} → {range[1].format("ddd, MMM D")}
          </span>
        </div>
        <div className="sk-pass-seg sk-pass-seg--from sk-pass-flat">
          <span className="sk-pass-label">
            <PlaneIcon
              size={12}
              aria-hidden="true"
              style={{ transform: "rotate(45deg)" }}
            />{" "}
            From
          </span>
          <AirportInput
            value={originDisplay}
            placeholder="Departing from"
            onChange={(ap) => {
              setOrigin(ap);
              setOriginDisplay(`${ap.city} (${ap.code})`);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="Where to?"
            onChange={(ap) => {
              setDest(ap);
              setDestDisplay(`${ap.city} (${ap.code})`);
            }}
          />
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
          aria-label="Search last-minute flights"
        >
          <SearchOutlined />
          <span className="sk-pass-go-text">Find a getaway</span>
        </button>
      </div>

      <div className="sk-stay-shortcuts">
        <div className="sk-stay-shortcut-row sk-ideas-row">
          <span className="sk-stay-shortcut-label">Ideas</span>
          {LAST_MINUTE_IDEAS.map((idea) => (
            <button
              key={idea.code}
              type="button"
              className={`sk-stay-chip${
                dest?.code === idea.code ? " is-active" : ""
              }`}
              onClick={() => {
                setDest({ code: idea.code, city: idea.city });
                setDestDisplay(`${idea.city} (${idea.code})`);
              }}
            >
              <span className="sk-chip-vibe">{idea.vibe}</span> {idea.city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
