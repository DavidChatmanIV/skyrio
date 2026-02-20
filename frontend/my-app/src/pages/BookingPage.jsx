import React, { useMemo, useState } from "react";
import {
  Layout,
  Typography,
  Space,
  Segmented,
  Button,
  Input,
  DatePicker,
  Card,
  Row,
  Col,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  TeamOutlined,
  StarFilled,
  EnvironmentOutlined,
} from "@ant-design/icons";

import heroImg from "../assets/Booking/skyrio-hero.jpg";
import "../styles/BookingPage.css";

/* Guest-gated Save Trip button */
import SaveTripButton from "../components/trips/SaveTripButton";

/* Trip Budget component */
import TripBudgetCard from "./booking/TripBudgetCard";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function BookingPage() {
  /* =============================
     Tabs
  ============================= */
  const [tab, setTab] = useState("Stays");

  /* =============================
     Quick Filters
  ============================= */
  const quickFilters = useMemo(
    () => ["Under $500", "Luxury", "Unwind", "Adventure", "Romantic"],
    []
  );
  const [activeFilters, setActiveFilters] = useState(["Under $500"]);

  const toggleFilter = (label) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const clearFilters = () => setActiveFilters([]);

  /* =============================
     Selected Result
  ============================= */
  const [selectedResult, setSelectedResult] = useState({
    id: "stay-1",
    title: "Skyrio Select Stay – Deluxe",
    total: 168,
  });

  /* =============================
     Budget State (source of truth)
  ============================= */
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

  /* =============================
     Booking Total (AUTO-UPDATED)
  ============================= */
  const bookingTotal = useMemo(
    () => Number(selectedResult?.total || 0),
    [selectedResult]
  );

  /* =============================
     Demo Save Handler
  ============================= */
  const handleSaveTrip = (source = "page") => {
    antdMessage.success(`Trip saved (${source})`);
  };

  /* =============================
     Demo Result Data
  ============================= */
  const rating = 4.7;
  const reviews = 1243;

  const bestFor = useMemo(
    () => ["Beach access", "Couples", "Great breakfast"],
    []
  );

  return (
    <Layout
      className="sk-booking"
      style={{ ["--sk-bg-image"]: `url(${heroImg})` }}
    >
      {/* ================= HERO ================= */}
      <div className="sk-booking-hero">
        <Title className="sk-hero-title">
          Let’s lock in your next adventure ✈️
        </Title>

        {/* Booking state header (matches mock vibe) */}
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

          <Text className="sk-hero-sub">
            Smart Plan AI helps balance budget, comfort, and XP.
          </Text>
        </div>

        <Segmented
          className="sk-booking-tabs sk-orange-segmented"
          value={tab}
          onChange={setTab}
          options={[
            "Stays",
            "Flights",
            "Cars",
            "Saved",
            "Cruises",
            "Excursions",
            "Packages",
            "Last-Minute",
          ]}
        />

        {/* Weather */}
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

        {/* Search */}
        <div className="sk-search-bar">
          <Input className="sk-glass-input" placeholder="New York (JFK)" />
          <RangePicker className="sk-orange-picker" />
          <Button className="sk-btn-orange">Rewards</Button>
          <Button className="sk-btn-orange">Price Watch</Button>
          <Button icon={<SearchOutlined />} className="sk-btn-orange">
            Search
          </Button>
        </div>

        {/* Action Row */}
        <Space className="sk-action-row" wrap>
          <Button className="sk-btn-orange">Sort: Recommended</Button>
          <SaveTripButton onSaveConfirmed={() => handleSaveTrip("hero")} />
          <Button className="sk-btn-orange" icon={<TeamOutlined />}>
            Team Travel
          </Button>
        </Space>

        {/* Filters */}
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

      {/* ================= RESULTS ================= */}
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
        </Col>

        {/* ================= RIGHT RAIL ================= */}
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
    </Layout>
  );
}