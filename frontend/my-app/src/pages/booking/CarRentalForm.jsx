// Cars tab search bar — same Boarding Pass markup/classes as the other tabs
// (Pick-up | When | Driver | search). Pick-up/drop-off times sit in a slim
// pill row under the pass so the bar stays the same height as other tabs.
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Select, message as antdMessage } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { MapPin, Calendar, User, Clock } from "lucide-react";
import AirportInput from "@/pages/booking/AirportInput";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import "@/styles/cars.css";

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 ? "30" : "00";
  const value = `${h}:${m}`;
  return { value, label: dayjs(`2000-01-01T${value}`).format("h:mm A") };
});
const AGES = [
  { value: "30", label: "30+" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(18 + i), label: String(18 + i) })),
];
const popup = { popup: { root: "sk-select-popup" } };

export default function CarRentalForm({ onDestChange, onSearch, initial = null }) {
  const [where, setWhere] = useState(null); // { code, city }
  const [whereText, setWhereText] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [age, setAge] = useState("30");

  const run = (o = {}) => {
    const where = o.where ?? whereRef.current;
    const dates = o.dates ?? datesRef.current;
    if (!where?.code) return antdMessage.warning("Pick a pick-up airport from the list");
    // where.code is an airport code, or a city name from a group trip link.
    if (!dates[0] || !dates[1]) return antdMessage.warning("Pick your pick-up and drop-off dates");
    onSearch?.({
      location: where.code,
      label:
        where.city && where.city !== where.code ? `${where.city} (${where.code})` : where.city || where.code,
      pickupDate: dayjs(dates[0]).format("YYYY-MM-DD"),
      dropoffDate: dayjs(dates[1]).format("YYYY-MM-DD"),
      pickupTime: o.pickupTime ?? pickupTime,
      dropoffTime: o.dropoffTime ?? dropoffTime,
      driverAge: o.driverAge ?? age,
      ...(o.rateId && { preselectRateId: o.rateId }),
      ...(o.match && { preselectMatch: o.match }),
    });
  };
  const whereRef = useRef(where);
  whereRef.current = where;
  const datesRef = useRef(dates);
  datesRef.current = dates;

  // Prefill from the link (to = airport code, depart/return dates).
  const prefilled = useRef(false);
  useEffect(() => {
    if (!initial || prefilled.current) return;
    prefilled.current = true;
    if (initial.code) {
      const p = { code: initial.code, city: initial.city || initial.code };
      setWhere(p);
      setWhereText(p.city);
      onDestChange?.(p.city);
    }
    const s = initial.start ? dayjs(initial.start) : null;
    const e = initial.end ? dayjs(initial.end) : null;
    const range = s?.isValid() && e?.isValid() ? [s, e] : null;
    if (range) setDates(range);
    if (initial.pickupTime) setPickupTime(initial.pickupTime);
    if (initial.dropoffTime) setDropoffTime(initial.dropoffTime);
    if (initial.driverAge) setAge(String(initial.driverAge));
    // From an Atlas card: run the same search and open the chosen car.
    if (initial.autoSearch && initial.code && range) {
      setTimeout(
        () =>
          run({
            where: { code: initial.code, city: initial.city || initial.code },
            dates: range,
            pickupTime: initial.pickupTime || undefined,
            dropoffTime: initial.dropoffTime || undefined,
            driverAge: initial.driverAge || undefined,
            rateId: initial.rateId || undefined,
            match: initial.match || undefined,
          }),
        0
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="sk-search-bar">
      <div className="sk-pass">
        <div className="sk-pass-seg sk-pass-seg--where sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> Pick-up
          </span>
          <AirportInput
            value={whereText}
            placeholder="Airport (e.g. MIA)"
            onChange={(ap) => {
              setWhere({ code: ap.code, city: ap.city });
              setWhereText(ap.city);
              onDestChange?.(ap.city);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Pick-up", "Drop-off"]}
            value={dates}
            onChange={(v) => setDates(v ?? [null, null])}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who sk-pass-flat">
          <span className="sk-pass-label">
            <User size={12} aria-hidden="true" /> Driver age
          </span>
          <Select
            className="sk-select-cabin"
            value={age}
            onChange={setAge}
            variant="borderless"
            suffixIcon={null}
            options={AGES}
            aria-label="Driver age"
            classNames={popup}
          />
        </div>
        <button type="button" className="sk-pass-go" onClick={run} aria-label="Search cars">
          <SearchOutlined />
          <span className="sk-pass-go-text">Find cars</span>
        </button>
      </div>

      {/* Times: native selects (phones get their own picker), styled like
          mini boarding-pass fields so they match the bar above. */}
      <div className="sk-car-times">
        <label className="sk-car-time">
          <span className="sk-car-time-label">
            <Clock size={12} aria-hidden="true" /> Pick-up time
          </span>
          <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="sk-car-time">
          <span className="sk-car-time-label">
            <Clock size={12} aria-hidden="true" /> Drop-off time
          </span>
          <select value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)}>
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
