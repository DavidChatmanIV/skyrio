import React, { useState } from "react";
import {
  Layout,
  Typography,
  Tabs,
  Card,
  Badge,
  Progress,
  Input,
  DatePicker,
  Button,
  Segmented,
  Select,
} from "antd";
import {
  StarOutlined,
  ClockCircleOutlined,
  BellOutlined,
  TrophyOutlined,
  SettingOutlined,
  HomeOutlined,
} from "@ant-design/icons";

import { useAuth } from "../hooks/useAuth";

// Components
import SavedExcursions from "../components/excursions/SavedExcursions";
import UpcomingBookings from "../components/dashboard/UpcomingBookings";
import TravelAlerts from "../components/dashboard/TravelAlerts";
import XPBadgeCard from "./passport/XPBadgeCard";
import FeedbackForm from "../components/FeedbackForm";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // ---------- Auth states ----------
  if (loading) {
    return (
      <Layout className="min-h-screen bg-white">
        <Content>
          <div style={{ padding: "2rem", textAlign: "center" }}>
            Loading your dashboard…
          </div>
        </Content>
      </Layout>
    );
  }

  if (!user) {
    // ProtectedRoute should normally handle this, but good as a fallback.
    return (
      <Layout className="min-h-screen bg-white">
        <Content>
          <div style={{ padding: "2rem", textAlign: "center" }}>
            You’re not logged in.
          </div>
        </Content>
      </Layout>
    );
  }

  // ---------- Derived user display info ----------
  const displayName =
    user.name ||
    user.username ||
    (user.email ? user.email.split("@")[0] : "Explorer");

  const xp = user.xp ?? 0;
  const levelLabel = user.levelLabel || "Globetrotter";
  const levelPct = user.levelProgressPct ?? 80;

  const stats = {
    trips: user.savedTripsCount ?? 0,
    notifications: user.unreadNotifications ?? 0,
  };

  const tabItems = [
    {
      key: "overview",
      label: (
        <span>
          <HomeOutlined /> Overview
        </span>
      ),
      children: (
        <Card bordered={false}>
          <h3 className="m-0">Welcome to your dashboard!</h3>
          <p className="mt-2 mb-0">
            Track your saved trips, progress, and travel alerts all in one
            place.
          </p>
        </Card>
      ),
    },
    {
      key: "saved-trips",
      label: (
        <span>
          <StarOutlined /> Saved Trips
        </span>
      ),
      children: <SavedExcursions />,
    },
    {
      key: "upcoming",
      label: (
        <span>
          <ClockCircleOutlined /> Upcoming
        </span>
      ),
      children: <UpcomingBookings />,
    },
    {
      key: "alerts",
      label: (
        <span>
          <Badge dot={stats.notifications > 0}>
            <BellOutlined /> Alerts
          </Badge>
        </span>
      ),
      children: <TravelAlerts />,
    },
    {
      key: "xp",
      label: (
        <span>
          <TrophyOutlined /> XP & Badges
        </span>
      ),
      children: <XPBadgeCard />,
    },
    {
      key: "settings",
      label: (
        <span>
          <SettingOutlined /> Settings
        </span>
      ),
      children: (
        <Card bordered={false}>
          <p className="mb-0">Update your profile and preferences here.</p>
        </Card>
      ),
    },
  ];

  return (
    <Layout className="min-h-screen bg-white">
      <Content>
        {/* ================= HERO (tight, clean, smooth) ================= */}
        <section
          className="
            relative w-full
            bg-gradient-to-b from-[#281B58] via-[#3B2A7A] to-[#C96645]
            text-white
          "
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="grid gap-4 sm:gap-6">
              {/* Greeting */}
              <header className="text-center">
                <h1 className="font-semibold tracking-[-0.02em] text-[28px] sm:text-[32px] leading-tight">
                  Good evening, {displayName} <span aria-hidden>🌆</span>
                </h1>
                <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/80">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">
                    XP {xp}
                  </span>
                  <span aria-hidden>•</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">
                    {stats.trips} saved trips
                  </span>
                  <span aria-hidden>•</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">
                    {stats.notifications} new
                  </span>
                </div>
              </header>

              {/* XP Card (compact) */}
              <Card
                bordered={false}
                className="mx-auto w-full max-w-xl rounded-2xl bg-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.24)] p-4"
                bodyStyle={{ padding: 0 }}
              >
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between text-[13px] text-white/85">
                    <span className="font-medium">XP Level</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-white/90">{levelLabel}</span>
                      <span className="text-white/70">{levelPct}%</span>
                    </span>
                  </div>

                  <Progress
                    percent={levelPct}
                    showInfo={false}
                    size="small"
                    strokeLinecap="round"
                    className="!m-0"
                  />

                  <p className="mt-2 text-[12px] text-white/70">
                    Earn XP with every booking.
                  </p>
                </div>
              </Card>

              {/* Booking/Search Bar */}
              <Card
                bordered={false}
                className="mx-auto w-full max-w-5xl rounded-2xl bg-white/10 backdrop-blur shadow-[0_8px_30px_rgb(0,0,0,0.24)]"
                bodyStyle={{ padding: "14px" }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-center">
                    <Segmented
                      size="large"
                      options={[
                        "Stays",
                        "Flights",
                        "Cars",
                        "Cruises",
                        "Packages",
                        "Excursions",
                      ]}
                      className="!bg-white/5 !p-1 rounded-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-2 sm:gap-3">
                    <Input
                      size="large"
                      allowClear
                      placeholder="City, landmark, or address"
                      className="rounded-xl bg-white text-gray-800"
                    />

                    <RangePicker
                      size="large"
                      className="rounded-xl bg-white"
                      style={{ width: "100%" }}
                    />

                    <Select
                      size="large"
                      className="rounded-xl bg-white"
                      defaultValue="2 adults · 1 room"
                      options={[
                        {
                          value: "1 adult · 1 room",
                          label: "1 adult · 1 room",
                        },
                        {
                          value: "2 adults · 1 room",
                          label: "2 adults · 1 room",
                        },
                        {
                          value: "2 adults · 2 rooms",
                          label: "2 adults · 2 rooms",
                        },
                        {
                          value: "Family (4) · 2 rooms",
                          label: "Family (4) · 2 rooms",
                        },
                      ]}
                    />

                    <Button
                      size="large"
                      type="primary"
                      className="
                        rounded-xl font-semibold shadow-md hover:shadow-lg transition
                        bg-gradient-to-r from-[#7C3AED] to-[#F97316] border-none
                      "
                    >
                      Search · Earn +50 XP
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ================= MAIN DASHBOARD CONTENT ================= */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Title level={2} className="!mb-1">
            📊 Dashboard
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
            Your Skyrio control center — XP, trips, and travel tools in one
            place.
          </Text>

          {/* Profile / XP Snapshot cards (from second snippet, but styled to fit) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <Card title="XP & Status" style={{ borderRadius: 16 }}>
              <Text strong>XP: </Text> <Text>{xp}</Text>
              <br />
              <Text strong>Level: </Text> <Text>{levelLabel}</Text>
              <br />
              <Text strong>Role: </Text> <Text>{user.role || "explorer"}</Text>
            </Card>

            <Card title="Profile Snapshot" style={{ borderRadius: 16 }}>
              <Text strong>Email: </Text> <Text>{user.email}</Text>
              <br />
              {user.username && (
                <>
                  <Text strong>Username: </Text> <Text>{user.username}</Text>
                  <br />
                </>
              )}
              <Text strong>Member since: </Text>
              <Text>
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "—"}
              </Text>
            </Card>
          </div>

          {/* Tabs Section */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            animated
          />

          {/* Feedback Form at the bottom */}
          <div className="mt-12">
            <FeedbackForm />
          </div>
        </div>
      </Content>
    </Layout>
  );
}
