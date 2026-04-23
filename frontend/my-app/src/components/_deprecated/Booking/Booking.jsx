import React, { useState, useEffect } from "react";
import {
  Layout,
  Typography,
  Button,
  Divider,
  Card,
  Row,
  Col,
  Space,
  Affix,
} from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import BookingForm from "../components/booking/BookingForm";
import FlightSearchForm from "../components/booking/FlightSearchForm";
import StaySearchForm from "../components/booking/StaySearchForm";
import StayTypeSelector from "../components/booking/StayTypeSelector";
import ResultsList from "../components/booking/ResultsList";
import PackageFilterForm from "../components/booking/PackageFilterForm";
import SavedTrips from "../components/booking/SavedTrips";
import ToastNotification from "../components/common/ToastNotification";
import { apiUrl } from "@/lib/api";

import "../styles/booking.css";

const { Content } = Layout;
const { Title, Text } = Typography;

const Booking = () => {
  console.log("[Booking.jsx] mounted ✅");

  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const [stayType, setStayType] = useState("hotel");
  const [stayResults, setStayResults] = useState([]);
  const [flightResults, setFlightResults] = useState([]);
  const [packageResults, setPackageResults] = useState([]);
  const [carResults, setCarResults] = useState([]);
  const [cruiseResults, setCruiseResults] = useState([]);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  useEffect(() => {
    fetch(apiUrl("/api/cars"))
      .then((res) => res.json())
      .then((cars) => setCarResults(cars))
      .catch(() => showToast("Failed to load cars.", "error"));

    fetch(apiUrl("/api/cruises"))
      .then((res) => res.json())
      .then((cruises) => setCruiseResults(cruises))
      .catch(() => showToast("Failed to load cruises.", "error"));
  }, []);

  return (
    <Layout style={{ background: "#f9fafb", minHeight: "100vh" }}>
      <Content>
        <Affix offsetTop={12}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 20px",
            }}
          >
            <Button
              type="default"
              size="large"
              shape="round"
              icon={<LeftOutlined />}
              onClick={handleBack}
              aria-label="Home (affix)"
            >
              Home
            </Button>
          </div>
        </Affix>

        <div className="booking-wrapper" data-testid="booking-wrapper">
          <Row align="middle" justify="center" style={{ marginBottom: 12 }}>
            <Col span={24} style={{ textAlign: "center" }}>
              <Title level={2} className="booking-title" style={{ margin: 0 }}>
                Book Your Next Adventure
              </Title>
              <div style={{ marginTop: 12 }}>
                <Space size="middle">
                  <Button
                    type="primary"
                    size="middle"
                    shape="round"
                    icon={<LeftOutlined />}
                    onClick={handleBack}
                    aria-label="Back to Home (inline)"
                  >
                    Back to Home
                  </Button>
                </Space>
              </div>
              <div style={{ marginTop: 10 }}>
                <Text>Level 1 – XP: 0/100</Text>
                <div className="xp-bar">
                  <div className="xp-fill" />
                </div>
              </div>
            </Col>
          </Row>

          <Card className="section-card mb-24">
            <BookingForm showToast={showToast} selectedType={stayType} />
          </Card>

          <Divider className="section-divider" />
          <Card className="section-card">
            <FlightSearchForm
              setFlightResults={setFlightResults}
              showToast={showToast}
            />
          </Card>
          <ResultsList
            title="✈️ Flight Results"
            results={flightResults}
            type="flight"
          />

          <Divider className="section-divider" />
          <Card className="section-card">
            <StaySearchForm
              setStayResults={setStayResults}
              selectedType={stayType}
              showToast={showToast}
            />
            <div className="mb-24" />
            <StayTypeSelector onTypeSelect={setStayType} />
          </Card>
          <ResultsList
            title={`🏡 ${stayType.toUpperCase()} Stays`}
            results={stayResults}
            type="stay"
          />
          <SavedTrips />

          <Divider className="section-divider" />
          <Card className="section-card">
            <PackageFilterForm
              setPackageResults={setPackageResults}
              showToast={showToast}
            />
          </Card>
          <ResultsList
            title="📦 Travel Packages"
            results={packageResults}
            type="package"
          />

          <Divider className="section-divider" />
          <ResultsList title="🚗 Rental Cars" results={carResults} type="car" />

          <Divider className="section-divider" />
          <ResultsList
            title="🚢 Cruise Deals"
            results={cruiseResults}
            type="cruise"
          />

          <ToastNotification
            type={toastType}
            message={toastMessage}
            visible={toastVisible}
            onClose={() => setToastVisible(false)}
          />
        </div>

        <button
          onClick={handleBack}
          aria-label="Home (fab)"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 2000,
            border: "none",
            borderRadius: 30,
            padding: "10px 14px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
            background: "#1677ff",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <LeftOutlined /> Home
          </span>
        </button>
      </Content>
    </Layout>
  );
};

export default Booking;
