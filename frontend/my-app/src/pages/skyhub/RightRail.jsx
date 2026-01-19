import React from "react";

const TRENDING = [
  { place: "Kyoto", pct: 42 },
  { place: "Santorini", pct: 31 },
  { place: "Puerto Rico", pct: 28 },
  { place: "Seoul", pct: 18 },
];

const DEALS = [
  { place: "Tokyo, Japan", price: "$640 RT", source: "Expedia" },
  { place: "Santorini, GR", price: "$899 RT", source: "Booking.com" },
];

export default function RightRail() {
  return (
    <aside className="sh-rightRail">
      <section className="sh-card">
        <h4 className="sh-cardTitle">Trending Places</h4>

        <div className="sh-hotList">
          {TRENDING.map((t) => (
            <div key={t.place} className="sh-hotItem">
              <div className="sh-hotRow">
                <span className="sh-hotName">{t.place}</span>
                <span className="sh-hotPct">{t.pct}%</span>
              </div>
              <div className="sh-bar">
                <div className="sh-barFill" style={{ width: `${t.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sh-card">
        <h4 className="sh-cardTitle">Travel Deals</h4>

        <div className="sh-deals">
          {DEALS.map((d) => (
            <div key={d.place} className="sh-dealCard">
              <div className="sh-dealPlace">{d.place}</div>
              <div className="sh-dealRow">
                <span className="sh-dealPrice">{d.price}</span>
                <span className="sh-dealSource">{d.source}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sh-dealNote">
          Deals are non-intrusive and will expand post-launch.
        </div>
      </section>
    </aside>
  );
}