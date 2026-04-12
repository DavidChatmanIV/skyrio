import React from "react";
import "@/styles/SkyHubTrendingDestinations.css";

export default function SkyHubTrendingDestinations({ items = [] }) {
  return (
    <section className="skyhub-sideCard">
      <div className="skyhub-sideHeader">
        <h3 className="skyhub-sideTitle">Trending Destinations</h3>
        <button type="button" className="skyhub-sideLink">
          See all →
        </button>
      </div>

      <div className="skyhub-trendingList">
        {items.map((item) => (
          <button key={item.id} type="button" className="skyhub-trendingItem">
            <div className="skyhub-trendingRank">{item.rank}</div>
            <div className="skyhub-trendingMeta">
              <div className="skyhub-trendingName">{item.name}</div>
              <div className="skyhub-trendingPosts">{item.posts}</div>
            </div>
            <div className="skyhub-trendingArrow">↗</div>
          </button>
        ))}
      </div>
    </section>
  );
}