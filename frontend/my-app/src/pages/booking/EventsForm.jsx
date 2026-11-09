// src/pages/booking/EventsForm.jsx
// Events tab search bar — same Boarding Pass markup/classes as ExcursionsForm
// (styles come from stays-search.css). Results render in BookingPage's results column.

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Select, message as antdMessage } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { MapPin, Calendar, Zap } from "lucide-react";
import AirportInput from "@/pages/booking/AirportInput";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";

export default function EventsForm({ onDestChange, onSearch, initial = null }) {
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [category, setCategory] = useState("all");

  const handleSearch = (opts = {}) => {
    const city = (opts.city ?? destDisplay).trim();
    const range = opts.dates ?? dates;
    if (!city) return antdMessage.warning("Enter a city to see events");

    onSearch?.({
      city,
      startDate: range[0] ? dayjs(range[0]).format("YYYY-MM-DD") : undefined,
      endDate: range[1] ? dayjs(range[1]).format("YYYY-MM-DD") : undefined,
      category,
    });
  };

  // Prefill from the link (same params as Excursions: city, depart, return).
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || prefilledRef.current) return;
    prefilledRef.current = true;
    if (initial.city) {
      setDestDisplay(initial.city);
      onDestChange?.(initial.city);
    }
    const start = initial.start ? dayjs(initial.start) : null;
    const end = initial.end ? dayjs(initial.end) : null;
    const range = start?.isValid() && end?.isValid() ? [start, end] : [null, null];
    setDates(range);
    if (initial.autoSearch && initial.city) {
      setTimeout(() => handleSearch({ city: initial.city, dates: range }), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="sk-search-bar">
      <div className="sk-pass">
        <div className="sk-pass-seg sk-pass-seg--where sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> Where
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="City"
            onChange={(ap) => {
              setDestDisplay(ap.city);
              onDestChange?.(ap.city);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            <span className="sk-pass-nights">· optional</span>
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Any day", "Any day"]}
            value={dates}
            onChange={(v) => setDates(v ?? [null, null])}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who sk-pass-flat">
          <span className="sk-pass-label">
            <Zap size={12} aria-hidden="true" /> What
          </span>
          <Select
            className="sk-select-cabin"
            value={category}
            onChange={setCategory}
            variant="borderless"
            suffixIcon={null}
            classNames={{ popup: { root: "sk-select-popup" } }}
            aria-label="Event type"
            options={[
              { value: "all", label: "All events" },
              { value: "sports", label: "Sports" },
              { value: "music", label: "Concerts" },
              { value: "shows", label: "Shows" },
              { value: "family", label: "Family" },
            ]}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={() => handleSearch()}
          aria-label="Search events"
        >
          <SearchOutlined />
          <span className="sk-pass-go-text">Find events</span>
        </button>
      </div>
    </div>
  );
}
