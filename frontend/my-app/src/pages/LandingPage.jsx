import React, { useMemo, useState } from "react";
import { Button, Card, Tag, Avatar } from "antd";
import { PlayCircleFilled, QuestionCircleOutlined } from "@ant-design/icons";

import PageLayout from "../components/PageLayout";
import TutorialModal from "../components/TutorialModal";
import SupportFormModal from "../components/SupportFormModal";

import "../styles/LandingPage.css";

/**
 * ✅ Keep image in src/assets and still use it safely:
 * Vite will fingerprint + serve correctly.
 */
import cosmicBg from "../assets/landing/skyrio-cosmic.jpg";

/* ✅ Recommended Destinations section (Weather + glass cards) */
import RecommendedDestinations from "../components/destinations/RecommendedDestinations";

const destinations = [
  { label: "Bali", emoji: "🏝️" },
  { label: "Tokyo", emoji: "🗼" },
  { label: "Rome", emoji: "🏛️" },
];

const testimonials = [
  {
    title: "Budget Travelers",
    icon: "🧳",
    quote: "XP makes planning so rewarding.",
    name: "Elena",
    role: "Early Explorer",
    stars: 5,
  },
  {
    title: "Solo Explorers",
    icon: "👤",
    quote: "It helped me save money and stay organized.",
    name: "Taylor",
    role: "Early Explorer",
    stars: 5,
  },
  {
    title: "Group & Family Trips",
    icon: "👨‍👩‍👧‍👦",
    quote: "Skyrio saved me money without the stress.",
    name: "Rana",
    role: "Early Explorer",
    stars: 5,
  },
];

function Stars({ count = 5 }) {
  return (
    <div className="sk-testStars" aria-label={`${count} star rating`}>
      {"★★★★★".slice(0, count)}
    </div>
  );
}

export default function LandingPage() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // ✅ Inline background style so we NEVER depend on CSS url("/src/...")
  const bgStyle = useMemo(
    () => ({
      backgroundImage: `url(${cosmicBg})`,
    }),
    []
  );

  return (
    <PageLayout className="page--landing" fullBleed withNavOffset={false}>
      <div className="sk-landing" aria-label="Skyrio Landing Page">
        {/* ✅ Background layers */}
        <div className="sk-landing-bg" style={bgStyle} aria-hidden="true" />
        <div className="sk-landing-vignette" aria-hidden="true" />

        {/* ✅ Content */}
        <div className="sk-landing-inner">
          {/* ✅ Top member pill */}
          <div className="sk-member-banner">
            <div className="sk-member-left">
              <div className="sk-member-title">🔒 Unlock member features</div>
              <div className="sk-member-sub">
                Sign in to get Member-only deals · XP rewards · Price-drop
                alerts · Saved trips + faster checkout.
              </div>
            </div>

            <div className="sk-member-actions">
              <button
                className="sk-btn sk-btn-primary"
                onClick={() => setTutorialOpen(true)}
                type="button"
              >
                Sign in
              </button>
              <button
                className="sk-btn sk-btn-ghost"
                onClick={() => setSupportOpen(true)}
                type="button"
              >
                Learn more
              </button>
            </div>
          </div>

          {/* ✅ Hero glass card (COMPACT, Option A: no “Welcome to”) */}
          <section className="sk-heroWrap" aria-label="Skyrio Hero">
            <Card bordered={false} className="sk-heroCard sk-heroCard--compact">
              {/* Brand mark only */}
              <div className="sk-heroBrand sk-heroBrand--compact">Skyrio</div>

              <h1 className="sk-heroH1 sk-heroH1--compact">
                Plan smarter.
                <br />
                Travel better.
              </h1>

              <h2 className="sk-heroH2 sk-heroH2--compact">
                Feel confident every step.
              </h2>

              <p className="sk-heroP sk-heroP--compact">
                Calm planning, real rewards, and smart price tracking — built
                for explorers who value clarity over chaos.
              </p>

              <div className="sk-heroCtas sk-heroCtas--compact">
                <Button
                  className="sk-ctaPrimary"
                  size="large"
                  onClick={() => setTutorialOpen(true)}
                >
                  ✈️ Plan my trip
                </Button>

                <Button
                  className="sk-ctaGhost"
                  size="large"
                  icon={<PlayCircleFilled />}
                  onClick={() => setTutorialOpen(true)}
                >
                  See how Skyrio works
                </Button>

                {/* Keep help as a smaller third option (doesn't add much height) */}
                <Button
                  className="sk-ctaGhost sk-ctaGhost--subtle"
                  size="large"
                  icon={<QuestionCircleOutlined />}
                  onClick={() => setSupportOpen(true)}
                >
                  Need help?
                </Button>
              </div>

              {/* Compact trust line (single line to reduce scroll) */}
              <div className="sk-heroBullets sk-heroBullets--compact">
                <div className="sk-bulletLine">
                  ⭐ Trusted by early explorers across <b>20+</b> destinations
                </div>
              </div>

              {/* Pills */}
              <div
                className="sk-destinationRow sk-destinationRow--compact"
                aria-label="Featured trips"
              >
                {destinations.map((d) => (
                  <Tag key={d.label} className="sk-destinationPill">
                    {d.emoji} {d.label}
                  </Tag>
                ))}
              </div>
            </Card>
          </section>

          {/* ✅ Divider */}
          <div className="sk-section-divider" aria-hidden="true" />

          {/* ✅ Feature grid */}
          <section aria-label="Skyrio features" className="sk-featureGridWrap">
            <div className="sk-featureGrid">
              <Card bordered={false} className="sk-featureCard">
                <div className="sk-featureInline">
                  <div className="sk-featureInlineIcon">🎁</div>
                  <div className="sk-featureInlineText">
                    <h3 className="sk-featureTitleText">Rewards</h3>
                    <p className="sk-featureDesc">
                      Earn XP every time you plan or book. Unlock perks as you
                      level up.
                    </p>
                  </div>
                </div>
              </Card>

              <Card bordered={false} className="sk-featureCard">
                <div className="sk-featureInline">
                  <div className="sk-featureInlineIcon">⚡</div>
                  <div className="sk-featureInlineText">
                    <h3 className="sk-featureTitleText">AI Trip Planner</h3>
                    <p className="sk-featureDesc">
                      Tell us your vibe. We build the trip around your budget.
                    </p>
                  </div>
                </div>
              </Card>

              <Card bordered={false} className="sk-featureCard">
                <div className="sk-featureInline">
                  <div className="sk-featureInlineIcon">📉</div>
                  <div className="sk-featureInlineText">
                    <h3 className="sk-featureTitleText">Price Tracking</h3>
                    <p className="sk-featureDesc">
                      We watch prices for you. Book when the moment is right.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ✅ Recommended (Weather cards) */}
          <RecommendedDestinations />

          {/* ✅ Testimonials */}
          <section className="sk-testimonials" aria-label="Testimonials">
            <div className="sk-sectionTitle">What travelers are saying</div>
            <div className="sk-sectionSub">
              Real feedback from early explorers using Skyrio to plan smarter
              trips
            </div>

            <div className="sk-testGrid">
              {testimonials.map((t) => (
                <div key={t.title} className="sk-testCard">
                  <div className="sk-testTop">
                    <div className="sk-testHeading">
                      <span className="sk-testIcon">{t.icon}</span>
                      <span className="sk-testTitle">{t.title}</span>
                    </div>
                    <div className="sk-testQuote">{t.quote}</div>
                  </div>

                  <div className="sk-testBottom">
                    <div className="sk-testUser">
                      <Avatar size={44} />
                      <div className="sk-testMeta">
                        <div className="sk-testName">{t.name}</div>
                        <div className="sk-testRole">{t.role}</div>
                      </div>
                    </div>
                    <Stars count={t.stars} />
                  </div>
                </div>
              ))}
            </div>

            {/* Helpful strip */}
            <div className="sk-helpfulRow">
              <div className="sk-helpfulQ">Was this helpful?</div>
              <button className="sk-helpfulBtn" type="button">
                👍 Yes
              </button>
              <div className="sk-helpfulSub">
                Your feedback helps us improve Skyrio for everyone.
              </div>
            </div>
          </section>
        </div>

        {/* Modals */}
        <TutorialModal
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
        />
        <SupportFormModal
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
        />
      </div>
    </PageLayout>
  );
}