import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Input,
  DatePicker,
  Button,
  Segmented,
  AutoComplete,
  Typography,
  Space,
  Tag,
  Empty,
  Divider,
  message,
  Spin,
} from "antd";
import {
  EnvironmentOutlined,
  CalendarOutlined,
  UserOutlined,
  SearchOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  HeartFilled,
  ClockCircleOutlined,
  DollarOutlined,
} from "@ant-design/icons";

import dayjs from "dayjs";
import "@/styles/BookingPage.css";
import heroBg from "@/assets/Booking/skyrio-hero.jpg";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const airportOptions = [
  { value: "Newark (EWR)" },
  { value: "Miami (MIA)" },
  { value: "Los Angeles (LAX)" },
  { value: "Atlanta (ATL)" },
  { value: "Chicago (ORD)" },
  { value: "Dallas (DFW)" },
  { value: "Tokyo (HND)" },
  { value: "London (LHR)" },
  { value: "Paris (CDG)" },
];

const mockFlights = [
  {
    id: 1,
    airline: "Delta",
    from: "EWR",
    to: "MIA",
    departTime: "8:20 AM",
    arriveTime: "11:28 AM",
    duration: "3h 08m",
    stops: "Nonstop",
    price: 286,
    badge: "Best Value",
  },
  {
    id: 2,
    airline: "JetBlue",
    from: "EWR",
    to: "MIA",
    departTime: "10:10 AM",
    arriveTime: "1:42 PM",
    duration: "3h 32m",
    stops: "Nonstop",
    price: 312,
    badge: "Smooth Timing",
  },
  {
    id: 3,
    airline: "American",
    from: "EWR",
    to: "MIA",
    departTime: "2:35 PM",
    arriveTime: "6:20 PM",
    duration: "3h 45m",
    stops: "1 stop",
    price: 244,
    badge: "Lower Price",
  },
];

function extractIata(value = "") {
  const match = value.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : "";
}

function parseDurationToMinutes(duration = "") {
  const match = duration.match(/(\d+)h\s*(\d+)m/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getInsight(results) {
  if (!results.length) {
    return {
      tone: "neutral",
      title: "Atlas is ready",
      text: "Search a route and Atlas will help balance price, timing, and comfort.",
    };
  }

  const cheapest = [...results].sort((a, b) => a.price - b.price)[0];

  return {
    tone: "smart",
    title: "Atlas insight",
    text: `${cheapest.airline} looks like the strongest value right now at $${cheapest.price}. Good price without making the trip feel inconvenient.`,
  };
}

function buildFlightMatchKey(flight) {
  return [
    "flight",
    String(flight.airline || "")
      .trim()
      .toLowerCase(),
    String(flight.from || "")
      .trim()
      .toLowerCase(),
    String(flight.to || "")
      .trim()
      .toLowerCase(),
    String(flight.departTime || "")
      .trim()
      .toLowerCase(),
    String(flight.arriveTime || "")
      .trim()
      .toLowerCase(),
    String(flight.duration || "")
      .trim()
      .toLowerCase(),
    String(flight.price ?? ""),
  ].join("__");
}

function buildSavedTripMatchKey(savedTrip) {
  const metadata = savedTrip?.metadata || {};
  return [
    String(savedTrip.tripType || "")
      .trim()
      .toLowerCase(),
    String(metadata.airline || "")
      .trim()
      .toLowerCase(),
    String(metadata.from || "")
      .trim()
      .toLowerCase(),
    String(metadata.to || "")
      .trim()
      .toLowerCase(),
    String(metadata.departTime || "")
      .trim()
      .toLowerCase(),
    String(metadata.arriveTime || "")
      .trim()
      .toLowerCase(),
    String(metadata.duration || "")
      .trim()
      .toLowerCase(),
    String(savedTrip.price ?? ""),
  ].join("__");
}

export default function BookingPage() {
  const [tripType, setTripType] = useState("Round Trip");
  const [activeTab, setActiveTab] = useState("Flights");
  const [from, setFrom] = useState("Newark (EWR)");
  const [to, setTo] = useState("Miami (MIA)");
  const [dates, setDates] = useState([
    dayjs().add(7, "day"),
    dayjs().add(12, "day"),
  ]);
  const [travelers, setTravelers] = useState("1 Traveler");
  const [sortBy, setSortBy] = useState("Recommended");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);

  const [savedTrips, setSavedTrips] = useState([]);
  const [loadingSavedTrips, setLoadingSavedTrips] = useState(true);
  const [savingKeys, setSavingKeys] = useState({});
  const [messageApi, contextHolder] = message.useMessage();

  const insight = useMemo(() => getInsight(results), [results]);

  const savedTripLookup = useMemo(() => {
    const map = new Map();

    for (const trip of savedTrips) {
      map.set(buildSavedTripMatchKey(trip), trip);
    }

    return map;
  }, [savedTrips]);

  const sortedResults = useMemo(() => {
    const list = [...results];

    if (sortBy === "Price: Low to High") {
      return list.sort((a, b) => a.price - b.price);
    }

    if (sortBy === "Duration") {
      return list.sort(
        (a, b) =>
          parseDurationToMinutes(a.duration) -
          parseDurationToMinutes(b.duration)
      );
    }

    return list;
  }, [results, sortBy]);

  const fetchSavedTrips = useCallback(async () => {
    try {
      setLoadingSavedTrips(true);

      const res = await fetch("/api/saved-trips", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401) {
        setSavedTrips([]);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch saved trips");
      }

      const data = await res.json();
      setSavedTrips(Array.isArray(data.savedTrips) ? data.savedTrips : []);
    } catch (err) {
      console.error("Saved trips fetch error:", err);
      setSavedTrips([]);
    } finally {
      setLoadingSavedTrips(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedTrips();
  }, [fetchSavedTrips]);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = async () => {
    const fromCode = extractIata(from);
    const toCode = extractIata(to);

    if (!fromCode || !toCode) {
      messageApi.warning("Please choose airports in the format City (IATA).");
      return;
    }

    if (!dates || !dates[0]) {
      messageApi.warning("Please choose your travel dates.");
      return;
    }

    setSearched(true);

    // Later replace with real backend search
    setResults(mockFlights);
    messageApi.success("Flights loaded.");
  };

  const createSavedTripPayload = (flight) => ({
    tripType: "flight",
    title: `${flight.airline} ${flight.from} → ${flight.to}`,
    destination: flight.to,
    image: "",
    price: Number(flight.price || 0),
    currency: "USD",
    startDate: dates?.[0] ? dayjs(dates[0]).format("YYYY-MM-DD") : "",
    endDate:
      tripType === "Round Trip" && dates?.[1]
        ? dayjs(dates[1]).format("YYYY-MM-DD")
        : "",
    metadata: {
      providerId: flight.id,
      airline: flight.airline,
      from: flight.from,
      to: flight.to,
      departTime: flight.departTime,
      arriveTime: flight.arriveTime,
      duration: flight.duration,
      stops: flight.stops,
      badge: flight.badge,
      travelers,
      bookingTab: activeTab,
    },
  });

  const toggleSave = async (flight) => {
    const matchKey = buildFlightMatchKey(flight);
    const existingSavedTrip = savedTripLookup.get(matchKey);

    if (savingKeys[matchKey]) return;

    setSavingKeys((prev) => ({ ...prev, [matchKey]: true }));

    try {
      if (existingSavedTrip) {
        const res = await fetch(
          `/api/saved-trips/${existingSavedTrip.id || existingSavedTrip._id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (res.status === 401) {
          messageApi.warning("Please log in to manage saved trips.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to remove saved trip");
        }

        setSavedTrips((prev) =>
          prev.filter(
            (trip) =>
              String(trip.id || trip._id) !==
              String(existingSavedTrip.id || existingSavedTrip._id)
          )
        );

        messageApi.success("Trip removed from saved trips.");
        return;
      }

      const payload = createSavedTripPayload(flight);

      const res = await fetch("/api/saved-trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        messageApi.warning("Please log in to save trips.");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to save trip");
      }

      const data = await res.json();

      if (data?.savedTrip) {
        setSavedTrips((prev) => [data.savedTrip, ...prev]);
      } else {
        await fetchSavedTrips();
      }

      messageApi.success("Trip saved successfully.");

      // optional XP hook
      fetch("/api/passport/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          type: "trip_saved",
          metadata: {
            airline: flight.airline,
            from: flight.from,
            to: flight.to,
            price: flight.price,
          },
        }),
      }).catch((err) => {
        console.warn("Passport activity hook failed:", err);
      });
    } catch (err) {
      console.error("Toggle save error:", err);
      messageApi.error(err.message || "Something went wrong while saving.");
    } finally {
      setSavingKeys((prev) => ({ ...prev, [matchKey]: false }));
    }
  };

  return (
    <div className="bookingPage" style={{ "--booking-bg": `url(${heroBg})` }}>
      {contextHolder}

      <section className="bookingHero">
        <div className="bookingHeroOverlay" />
        <div className="bookingContainer">
          <div className="bookingHeroTop">
            <Tag className="bookingBadge">Skyrio Booking</Tag>
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              options={["Flights", "Hotels", "Packages", "Cars"]}
              className="bookingTopTabs"
            />
          </div>

          <div className="bookingHeroCopy">
            <Title level={1} className="bookingTitle">
              Let’s lock in your next adventure ✈️
            </Title>
            <Paragraph className="bookingSubtitle">
              Search fast, compare smarter, and let Atlas guide the best option.
            </Paragraph>
          </div>

          <Card className="bookingSearchCard" bordered={false}>
            <div className="bookingTripTypeRow">
              <Segmented
                value={tripType}
                onChange={setTripType}
                options={["Round Trip", "One Way"]}
              />
            </div>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={10}>
                <label className="bookingLabel">From</label>
                <AutoComplete
                  value={from}
                  onChange={setFrom}
                  options={airportOptions}
                  size="large"
                >
                  <Input
                    prefix={<EnvironmentOutlined />}
                    placeholder="Newark (EWR)"
                    className="bookingInput"
                  />
                </AutoComplete>
              </Col>

              <Col xs={24} md={2} className="bookingSwapCol">
                <Button
                  shape="circle"
                  icon={<SwapOutlined />}
                  onClick={handleSwap}
                  className="bookingSwapBtn"
                />
              </Col>

              <Col xs={24} md={10}>
                <label className="bookingLabel">To</label>
                <AutoComplete
                  value={to}
                  onChange={setTo}
                  options={airportOptions}
                  size="large"
                >
                  <Input
                    prefix={<EnvironmentOutlined />}
                    placeholder="Miami (MIA)"
                    className="bookingInput"
                  />
                </AutoComplete>
              </Col>

              <Col xs={24} md={14}>
                <label className="bookingLabel">Dates</label>
                <RangePicker
                  value={dates}
                  onChange={setDates}
                  size="large"
                  className="bookingDatePicker"
                  suffixIcon={<CalendarOutlined />}
                  style={{ width: "100%" }}
                />
              </Col>

              <Col xs={24} md={6}>
                <label className="bookingLabel">Travelers</label>
                <Input
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  prefix={<UserOutlined />}
                  size="large"
                  className="bookingInput"
                />
              </Col>

              <Col xs={24} md={4}>
                <label className="bookingLabel bookingLabelHidden">
                  Search
                </label>
                <Button
                  type="primary"
                  size="large"
                  icon={<SearchOutlined />}
                  className="bookingSearchBtn"
                  block
                  onClick={handleSearch}
                >
                  Search
                </Button>
              </Col>
            </Row>
          </Card>
        </div>
      </section>

      <section className="bookingMain">
        <div className="bookingContainer">
          <Row gutter={[20, 20]} align="top">
            <Col xs={24} lg={16}>
              <Card className="bookingResultsCard" bordered={false}>
                <div className="bookingSectionHead">
                  <div>
                    <Title level={3} className="bookingSectionTitle">
                      {activeTab} Results
                    </Title>
                    <Text className="bookingSectionSub">
                      Clean, easy-to-scan options built for fast decisions.
                    </Text>
                  </div>

                  <Segmented
                    value={sortBy}
                    onChange={setSortBy}
                    options={["Recommended", "Price: Low to High", "Duration"]}
                    className="bookingSortTabs"
                  />
                </div>

                <Divider className="bookingDivider" />

                {!searched ? (
                  <div className="bookingEmptyState">
                    <Empty description="Search your route to see live-ready results here." />
                  </div>
                ) : sortedResults.length === 0 ? (
                  <div className="bookingEmptyState">
                    <Empty description="No results found for this search." />
                  </div>
                ) : (
                  <Space
                    direction="vertical"
                    size={16}
                    style={{ width: "100%" }}
                  >
                    {sortedResults.map((flight) => {
                      const matchKey = buildFlightMatchKey(flight);
                      const isSaved = savedTripLookup.has(matchKey);
                      const isSaving = Boolean(savingKeys[matchKey]);

                      return (
                        <Card
                          key={flight.id}
                          className="flightResultCard"
                          bordered={false}
                        >
                          <div className="flightCardTop">
                            <div>
                              <Tag color="gold" className="flightTag">
                                {flight.badge}
                              </Tag>
                              <Title level={5} className="flightAirline">
                                {flight.airline}
                              </Title>
                            </div>

                            <div className="flightPriceWrap">
                              <Text className="flightPriceLabel">from</Text>
                              <Title level={3} className="flightPrice">
                                ${flight.price}
                              </Title>
                            </div>
                          </div>

                          <div className="flightRouteRow">
                            <div className="flightTimeBlock">
                              <Text className="flightTime">
                                {flight.departTime}
                              </Text>
                              <Text className="flightCode">{flight.from}</Text>
                            </div>

                            <div className="flightMiddle">
                              <Text className="flightDuration">
                                {flight.duration}
                              </Text>
                              <div className="flightLine" />
                              <Text className="flightStops">
                                {flight.stops}
                              </Text>
                            </div>

                            <div className="flightTimeBlock">
                              <Text className="flightTime">
                                {flight.arriveTime}
                              </Text>
                              <Text className="flightCode">{flight.to}</Text>
                            </div>
                          </div>

                          <div className="flightActions">
                            <Button
                              icon={
                                isSaving ? (
                                  <Spin size="small" />
                                ) : isSaved ? (
                                  <HeartFilled />
                                ) : (
                                  <HeartOutlined />
                                )
                              }
                              className={
                                isSaved ? "saveBtn isSaved" : "saveBtn"
                              }
                              onClick={() => toggleSave(flight)}
                              disabled={isSaving}
                            >
                              {isSaving
                                ? "Updating..."
                                : isSaved
                                ? "Saved"
                                : "Save Trip"}
                            </Button>

                            <Button type="primary" className="selectBtn">
                              Select
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </Space>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Space direction="vertical" size={20} style={{ width: "100%" }}>
                <Card className="bookingSideCard atlasCard" bordered={false}>
                  <div className="sideCardHeader">
                    <Space>
                      <ThunderboltOutlined />
                      <Text strong>Atlas Insight</Text>
                    </Space>
                  </div>

                  <Title level={4} className="sideCardTitle">
                    {insight.title}
                  </Title>

                  <Paragraph className="sideCardText">{insight.text}</Paragraph>

                  <Button className="sideGhostBtn">Use suggestion</Button>
                </Card>

                <Card className="bookingSideCard budgetCard" bordered={false}>
                  <div className="sideCardHeader">
                    <Space>
                      <DollarOutlined />
                      <Text strong>Trip Budget</Text>
                    </Space>
                  </div>

                  <Title level={4} className="sideCardTitle">
                    Keep your trip smooth
                  </Title>

                  <Paragraph className="sideCardText">
                    Start with flights first. Then Skyrio can help pace your
                    stay, transport, and activity spend without making the trip
                    feel rushed.
                  </Paragraph>

                  <div className="budgetStats">
                    <div className="budgetStat">
                      <Text className="budgetStatLabel">Suggested range</Text>
                      <Text className="budgetStatValue">$780–$1200</Text>
                    </div>
                    <div className="budgetStat">
                      <Text className="budgetStatLabel">Trip pace</Text>
                      <Text className="budgetStatValue">Balanced</Text>
                    </div>
                  </div>
                </Card>

                <Card
                  className="bookingSideCard tripHealthCard"
                  bordered={false}
                >
                  <div className="sideCardHeader">
                    <Space>
                      <ClockCircleOutlined />
                      <Text strong>Trip Health</Text>
                    </Space>
                  </div>

                  <Paragraph className="sideCardText">
                    Good flow starts with fewer choices on screen. Keep search
                    simple, let results do the selling, and use Atlas for
                    confidence after the user sees options.
                  </Paragraph>

                  <Divider style={{ margin: "16px 0" }} />

                  <Text type="secondary">
                    Saved trips loaded:{" "}
                    {loadingSavedTrips ? "..." : savedTrips.length}
                  </Text>
                </Card>
              </Space>
            </Col>
          </Row>
        </div>
      </section>
    </div>
  );
}