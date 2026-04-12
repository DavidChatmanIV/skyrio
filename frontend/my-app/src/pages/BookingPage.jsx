import React, { useMemo, useState } from "react";
import {
  Typography,
  Space,
  Segmented,
  Button,
  DatePicker,
  Card,
  Row,
  Col,
  Select,
  InputNumber,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  StarFilled,
  EnvironmentOutlined,
  LoadingOutlined,
  SwapOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

import heroImg from "@/assets/Booking/skyrio-hero.jpg";
import "@/styles/BookingPage.css";

import SaveTripButton from "@/components/trips/SaveTripButton";
import TripBudgetCard from "./booking/TripBudgetCard";
import AirportInput from "@/pages/booking/AirportInput";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ─────────────────────────────────────────────
// Shared orange pill Search button
// ─────────────────────────────────────────────
function SearchBtn({ onClick, loading }) {
  return (
    <Button
      className="sk-btn-orange sk-btn-search-pill"
      icon={loading ? <LoadingOutlined /> : <SearchOutlined />}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Searching…" : "Search"}
    </Button>
  );
}

// ─────────────────────────────────────────────
// FLIGHTS
// ─────────────────────────────────────────────
function FlightsForm({ onSearch }) {
  const [originAirport, setOriginAirport] = useState(null);
  const [destAirport, setDestAirport] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!originAirport)
      return antdMessage.warning("Select a departure airport");
    if (!destAirport)
      return antdMessage.warning("Select a destination airport");
    if (!dates[0]) return antdMessage.warning("Select a departure date");

    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: originAirport.code,
        to: destAirport.code,
        departDate: dayjs(dates[0].toDate()).format("YYYY-MM-DD"),
        adults: String(adults),
        cabin,
      });
      if (dates[1])
        params.set("returnDate", dayjs(dates[1].toDate()).format("YYYY-MM-DD"));

      const res = await fetch(`/api/flights/search?${params}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Search failed");

      onSearch(data.flights);
      antdMessage.success(`Found ${data.flights.length} flights`);
    } catch (err) {
      antdMessage.error(err.message || "Flight search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setOriginAirport(destAirport);
    setDestAirport(originAirport);
    setOriginDisplay(destDisplay);
    setDestDisplay(originDisplay);
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-airport-pair">
        <AirportInput
          value={originDisplay}
          placeholder="From: City or airport"
          onChange={(ap) => {
            setOriginAirport(ap);
            setOriginDisplay(`${ap.city} (${ap.code})`);
          }}
        />
        <button
          type="button"
          className="sk-swap-btn"
          onClick={handleSwap}
          title="Swap airports"
        >
          <SwapOutlined />
        </button>
        <AirportInput
          value={destDisplay}
          placeholder="To: City or airport"
          onChange={(ap) => {
            setDestAirport(ap);
            setDestDisplay(`${ap.city} (${ap.code})`);
          }}
        />
      </div>
      <RangePicker
        className="sk-orange-picker"
        onChange={(vals) => setDates(vals ?? [null, null])}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        value={cabin}
        onChange={setCabin}
        popupClassName="sk-select-popup"
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
  );
}

// ─────────────────────────────────────────────
// STAYS
// ─────────────────────────────────────────────
function StaysForm() {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Where to? City or hotel"
        onChange={() => {}}
      />
      <RangePicker
        className="sk-orange-picker"
        placeholder={["Check-in", "Check-out"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="2t1r"
        popupClassName="sk-select-popup"
      >
        <Option value="1t1r">1 traveler, 1 room</Option>
        <Option value="2t1r">2 travelers, 1 room</Option>
        <Option value="3t1r">3 travelers, 1 room</Option>
        <Option value="2t2r">2 travelers, 2 rooms</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

// ─────────────────────────────────────────────
// CARS
// ─────────────────────────────────────────────
function CarsForm() {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Pick-up location"
        onChange={() => {}}
      />
      <AirportInput
        value=""
        placeholder="Drop-off (same as pick-up)"
        onChange={() => {}}
      />
      <RangePicker
        className="sk-orange-picker"
        placeholder={["Pick-up date", "Drop-off date"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <SearchBtn />
    </div>
  );
}

// ─────────────────────────────────────────────
// PACKAGES
// ─────────────────────────────────────────────
function PackagesForm() {
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [pkgOptions, setPkgOptions] = useState({
    stay: true,
    flight: true,
    car: false,
  });
  const toggle = (key) => setPkgOptions((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="sk-search-bar">
      <div className="sk-search-bar-pills">
        <button
          type="button"
          className={`sk-pkg-pill ${pkgOptions.stay ? "is-active" : ""}`}
          onClick={() => toggle("stay")}
        >
          🏨 Stay{pkgOptions.stay ? " added" : ""}
        </button>
        <button
          type="button"
          className={`sk-pkg-pill ${pkgOptions.flight ? "is-active" : ""}`}
          onClick={() => toggle("flight")}
        >
          ✈ Flight{pkgOptions.flight ? " added" : ""}
        </button>
        <button
          type="button"
          className={`sk-pkg-pill ${pkgOptions.car ? "is-active" : ""}`}
          onClick={() => toggle("car")}
        >
          🚗 Car{pkgOptions.car ? " added" : ""}
        </button>
      </div>
      <AirportInput
        value={originDisplay}
        placeholder="Leaving from"
        onChange={(ap) => setOriginDisplay(`${ap.city} (${ap.code})`)}
      />
      <AirportInput
        value={destDisplay}
        placeholder="Going to"
        onChange={(ap) => setDestDisplay(`${ap.city} (${ap.code})`)}
      />
      <RangePicker
        className="sk-orange-picker"
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="2t1r"
        popupClassName="sk-select-popup"
      >
        <Option value="1t1r">1 traveler, 1 room</Option>
        <Option value="2t1r">2 travelers, 1 room</Option>
        <Option value="2t2r">2 travelers, 2 rooms</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

// ─────────────────────────────────────────────
// EXCURSIONS
// ─────────────────────────────────────────────
function ExcursionsForm() {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Destination city"
        onChange={() => {}}
      />
      <RangePicker
        className="sk-orange-picker"
        placeholder={["Activity from", "Activity to"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="any"
        popupClassName="sk-select-popup"
      >
        <Option value="any">Any category</Option>
        <Option value="tours">Tours</Option>
        <Option value="adventure">Adventure</Option>
        <Option value="food">Food & Drink</Option>
        <Option value="culture">Culture</Option>
        <Option value="wellness">Wellness</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

// ─────────────────────────────────────────────
// LAST MINUTE
// ─────────────────────────────────────────────
function LastMinuteForm() {
  return (
    <div className="sk-search-bar">
      <AirportInput value="" placeholder="Departing from" onChange={() => {}} />
      <Select
        className="sk-select-cabin"
        defaultValue="anywhere"
        popupClassName="sk-select-popup"
      >
        <Option value="anywhere">✨ Anywhere</Option>
        <Option value="beach">🏖 Beach</Option>
        <Option value="city">🏙 City break</Option>
        <Option value="mountains">⛰ Mountains</Option>
        <Option value="theme">🎡 Theme parks</Option>
      </Select>
      <RangePicker
        className="sk-orange-picker"
        placeholder={["This weekend", "Next weekend"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <SearchBtn />
    </div>
  );
}

// ─────────────────────────────────────────────
// SAVED
// ─────────────────────────────────────────────
function SavedForm() {
  return (
    <div className="sk-search-bar" style={{ justifyContent: "center" }}>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
        💾 Your saved trips will appear in results below
      </Text>
    </div>
  );
}

const TAB_FORMS = {
  Stays: StaysForm,
  Flights: null,
  Cars: CarsForm,
  Saved: SavedForm,
  Excursions: ExcursionsForm,
  Packages: PackagesForm,
  "Last-Minute": LastMinuteForm,
};

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function BookingPage() {
  const [tab, setTab] = useState("Stays");
  const [flightResults, setFlightResults] = useState([]);

  const quickFilters = useMemo(
    () => ["Under $500", "Luxury", "Unwind", "Adventure", "Romantic"],
    []
  );
  const [activeFilters, setActiveFilters] = useState(["Under $500"]);
  const toggleFilter = (label) =>
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  const clearFilters = () => setActiveFilters([]);

  const [selectedResult, setSelectedResult] = useState({
    id: "stay-1",
    title: "Skyrio Select Stay – Deluxe",
    total: 168,
  });
  const [budgetTotal, setBudgetTotal] = useState(null);
  const [used, setUsed] = useState(0);
  const [expenseAmount, setExpenseAmount] = useState(0);

  const addExpense = () => {
    const amt = Number(expenseAmount || 0);
    if (!amt || amt <= 0) return;
    setUsed((prev) => Number(prev || 0) + amt);
    setExpenseAmount(null);
  };
  const resetBudget = () => {
    setBudgetTotal(null);
    setUsed(0);
    setExpenseAmount(0);
    antdMessage.info("Budget reset");
  };

  const bookingTotal = useMemo(
    () => Number(selectedResult?.total || 0),
    [selectedResult]
  );
  const handleSaveTrip = (src = "page") =>
    antdMessage.success(`Trip saved! (${src})`);

  const rating = 4.7;
  const reviews = 1243;
  const bestFor = useMemo(
    () => ["Beach access", "Couples", "Great breakfast"],
    []
  );

  const ActiveForm = TAB_FORMS[tab];
  const searchForm =
    tab === "Flights" ? (
      <FlightsForm onSearch={(flights) => setFlightResults(flights)} />
    ) : ActiveForm ? (
      <ActiveForm />
    ) : null;

  return (
    <div className="sk-booking" style={{ "--sk-bg-image": `url(${heroImg})` }}>
      {/* ── HERO ── */}
      <div className="sk-booking-hero">
        <Title className="sk-hero-title">
          Let's lock in your next adventure ✈️
        </Title>

        <div className="sk-tripState">
          <div className="sk-tripRoute">New York → Miami</div>
          <div className="sk-tripMeta">
            3 nights • Sunny all week • Best value window
          </div>
          <div className="sk-tripAssist">
            Smart Plan found 4 great options for you
          </div>
          <Space size="middle" className="sk-hero-pills">
            <div className="sk-pill sk-pill-orange">⚡ XP 60</div>
            <div className="sk-pill sk-pill-glass">💾 8 Saved</div>
            <div className="sk-pill sk-pill-glass">👁 Price Watch Off</div>
          </Space>
        </div>

        <Text className="sk-hero-sub">
          Smart Plan AI helps balance budget, comfort, and XP.
        </Text>

        <Segmented
          className="sk-booking-tabs sk-orange-segmented"
          value={tab}
          onChange={(val) => {
            setTab(val);
            setFlightResults([]);
          }}
          options={[
            "Stays",
            "Flights",
            "Cars",
            "Saved",
            "Excursions",
            "Packages",
            "Last-Minute",
          ]}
        />

        <div className="sk-weatherStrip">
          <div className="sk-weatherInner">
            <div className="sk-weatherTop">
              <span className="sk-weatherIcon">🌤</span>
              <span className="sk-weatherTitle">
                Miami Weather • Avg 78° / 65°
              </span>
            </div>
            <div className="sk-weatherSub">Mostly sunny • Low rain risk</div>
          </div>
        </div>

        {searchForm}

        <Space className="sk-action-row" wrap>
          <Button className="sk-btn-orange">Sort: Recommended</Button>

          {/* ── Fixed SaveTripButton — now gets onSaveConfirmed prop ── */}
          <SaveTripButton onSaveConfirmed={() => handleSaveTrip("hero")} />

          {/* ── Sync Together replaces Team Travel ── */}
          <Link to="/sync-together">
            <Button className="sk-btn-sync" icon={<SyncOutlined />}>
              ✈️ Sync Together
            </Button>
          </Link>
        </Space>

        <Space className="sk-filters" wrap>
          {quickFilters.map((f) => (
            <button
              key={f}
              type="button"
              className={`sk-qf ${
                activeFilters.includes(f) ? "is-active" : ""
              }`}
              onClick={() => toggleFilter(f)}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            className="sk-qf sk-qf-clear"
            onClick={clearFilters}
          >
            Clear quick filters →
          </button>
        </Space>
      </div>

      {/* ── RESULTS ── */}
      <Row gutter={[24, 24]} className="sk-results-wrap">
        <Col xs={24} lg={16}>
          <div className="sk-resultsHeader">
            <Title level={4} className="sk-section-title">
              Results
            </Title>
            <div className="sk-resultsSub">
              Curated picks based on your budget + comfort preferences.
            </div>
          </div>

          {flightResults.length > 0 &&
            flightResults.map((flight) => (
              <Card
                key={flight.id}
                variant="borderless"
                className={`sk-result-card ${
                  selectedResult.id === flight.id ? "is-selected" : ""
                }`}
                onClick={() =>
                  setSelectedResult({
                    id: flight.id,
                    title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                    total: parseFloat(flight.totalAmount),
                  })
                }
                style={{ cursor: "pointer", marginBottom: 16 }}
              >
                <div className="sk-resultRow">
                  <div className="sk-thumb" />
                  <div className="sk-resultMain">
                    <div className="sk-resultTop">
                      <div>
                        <div className="sk-resultTitle">{flight.owner}</div>
                        <div className="sk-resultMeta">
                          <span className="sk-metaItem">
                            <EnvironmentOutlined /> {flight.origin} →{" "}
                            {flight.destination}
                          </span>
                          <span className="sk-metaDot">•</span>
                          <span className="sk-metaItem">
                            {flight.stops === 0
                              ? "Nonstop"
                              : `${flight.stops} stop${
                                  flight.stops > 1 ? "s" : ""
                                }`}
                          </span>
                          {flight.departingAt && (
                            <>
                              <span className="sk-metaDot">•</span>
                              <span className="sk-metaItem">
                                {dayjs(flight.departingAt).format("h:mm A")} →{" "}
                                {dayjs(flight.arrivingAt).format("h:mm A")}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="sk-pickedWhy">
                          Why Skyrio picked this: best price + comfort score
                        </div>
                      </div>
                      <div className="sk-resultRight">
                        <div className="sk-priceLine">
                          <span className="sk-priceAmt">
                            ${parseFloat(flight.totalAmount).toFixed(0)}
                          </span>
                          <span className="sk-priceSub">
                            {flight.totalCurrency}
                          </span>
                        </div>
                        <SaveTripButton
                          size="small"
                          variant="ghost"
                          label="Save"
                          onSaveConfirmed={() => handleSaveTrip("result")}
                        />
                      </div>
                    </div>
                    <div className="sk-tagRow">
                      <span className="sk-tag sk-tag-good">
                        {flight.stops === 0
                          ? "Nonstop"
                          : `${flight.stops} stop`}
                      </span>
                      <span className="sk-tag sk-tag-orange">
                        {flight.ownerCode}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

          {flightResults.length === 0 && (
            <Card
              variant="borderless"
              className={`sk-result-card ${
                selectedResult.id === "stay-1" ? "is-selected" : ""
              }`}
              onClick={() =>
                setSelectedResult({
                  id: "stay-1",
                  title: "Skyrio Select Stay – Deluxe",
                  total: 168,
                })
              }
              style={{ cursor: "pointer" }}
            >
              <div className="sk-resultRow">
                <div className="sk-thumb" />
                <div className="sk-resultMain">
                  <div className="sk-resultTop">
                    <div>
                      <div className="sk-resultTitle">
                        Skyrio Select Stay – Deluxe
                      </div>
                      <div className="sk-resultMeta">
                        <span className="sk-metaItem">
                          <EnvironmentOutlined /> New York → Miami
                        </span>
                        <span className="sk-metaDot">•</span>
                        <span className="sk-metaItem">
                          <StarFilled className="sk-star" /> {rating}
                          <span className="sk-reviews">
                            {" "}
                            ({reviews.toLocaleString()})
                          </span>
                        </span>
                      </div>
                      <div className="sk-pickedWhy">
                        Why Skyrio picked this: high rating + best value this
                        window
                      </div>
                    </div>
                    <div className="sk-resultRight">
                      <div className="sk-priceLine">
                        <span className="sk-priceAmt">$168</span>
                        <span className="sk-priceSub">total</span>
                      </div>
                      <SaveTripButton
                        size="small"
                        variant="ghost"
                        label="Save"
                        onSaveConfirmed={() => handleSaveTrip("result")}
                      />
                    </div>
                  </div>
                  <div className="sk-tagRow">
                    <span className="sk-tag sk-tag-good">Best Value</span>
                    <span className="sk-tag sk-tag-orange">
                      Free cancellation
                    </span>
                    <span className="sk-tag sk-tag-soft">No resort fee</span>
                  </div>
                  <div className="sk-bestFor">
                    <span className="sk-bestForLabel">Best for:</span>
                    {bestFor.map((t) => (
                      <span key={t} className="sk-tag sk-tag-bestfor">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <TripBudgetCard
            bookingTotal={bookingTotal}
            planned={budgetTotal}
            used={used}
            expenseAmount={expenseAmount}
            onChangePlanned={setBudgetTotal}
            onChangeExpenseAmount={setExpenseAmount}
            onAddExpense={addExpense}
            onReset={resetBudget}
            tripDays={3}
          />
        </Col>
      </Row>
    </div>
  );
}