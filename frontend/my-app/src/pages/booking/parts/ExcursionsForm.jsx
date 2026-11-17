// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect, useRef } from "react";
import { Select, message as antdMessage } from "antd";
import { SearchOutlined, LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import AirportInput from "@/pages/booking/AirportInput";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import { useExcursionSearch } from "@/hooks/useExcursionSearch";
import { Zap, MapPin, Calendar } from "lucide-react";

export function ExcursionsForm({
  onDestChange,
  onSearch,
  onSearchStart,
  onSearchEnd,
  initial = null,
}) {
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [category, setCategory] = useState("any");
  const {
    loading,
    results,
    error,
    search: runExcursionSearch,
  } = useExcursionSearch();

  // Forward results/errors up to BookingPage whenever they change —
  // mirrors how FlightsForm/StaysForm call onSearch(data) after their
  // own fetch resolves, just via effect since this hook owns its
  // own state instead of returning data directly from search().
  useEffect(() => {
    onSearch?.(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  useEffect(() => {
    if (error) antdMessage.warning(error);
  }, [error]);

  const handleSearch = async (opts = {}) => {
    const dest = (opts.city ?? destDisplay).trim();
    const range = opts.dates ?? dates;
    if (!dest) return antdMessage.warning("Enter a destination city");

    onSearchStart?.();
    await runExcursionSearch({
      destination: dest,
      startDate: range[0]
        ? dayjs(range[0].toDate()).format("YYYY-MM-DD")
        : undefined,
      endDate: range[1]
        ? dayjs(range[1].toDate()).format("YYYY-MM-DD")
        : undefined,
      category: category !== "any" ? category : undefined,
    });
    onSearchEnd?.();
  };

  // Prefill from the link (e.g. "Find activities" on a Sync Together trip).
  const excursionPrefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || excursionPrefilledRef.current) return;
    excursionPrefilledRef.current = true;
    if (initial.city) {
      setDestDisplay(initial.city);
      onDestChange?.(initial.city);
    }
    const start = initial.start ? dayjs(initial.start) : null;
    const end = initial.end ? dayjs(initial.end) : null;
    const range =
      start?.isValid() && end?.isValid() ? [start, end] : [null, null];
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
            placeholder="Destination city"
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
            aria-label="Activity type"
            options={[
              { value: "any", label: "Anything fun" },
              { value: "tours", label: "Tours" },
              { value: "adventure", label: "Adventure" },
              { value: "food", label: "Food & Drink" },
              { value: "culture", label: "Culture" },
              { value: "wellness", label: "Wellness" },
            ]}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={() => handleSearch()}
          disabled={loading}
          aria-label="Search things to do"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Find things to do"}
          </span>
        </button>
      </div>
    </div>
  );
}
