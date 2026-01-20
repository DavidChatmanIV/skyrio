import React from "react";
import DestinationCard from "./DestinationCard";

export default function RecommendedDestinations() {
  const items = [
    {
      title: "Tokyo",
      lat: 35.6762,
      lon: 139.6503,
      // replace with your real images
      image:
        "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Kyoto",
      lat: 35.0116,
      lon: 135.7681,
      image:
        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1400&q=80",
    },
  ];

  return (
    <section className="sk-recSection">
      <h2 className="sk-recTitle">Recommended for travelers like you</h2>

      <div className="sk-recGrid">
        {items.map((it) => (
          <DestinationCard
            key={it.title}
            title={it.title}
            image={it.image}
            lat={it.lat}
            lon={it.lon}
            onClick={() => {
              // later: navigate to booking w/ destination prefilled
              console.log("clicked", it.title);
            }}
          />
        ))}
      </div>

      <div className="sk-recCtaRow">
        <button className="sk-primaryCta" type="button">
          ✈️ Plan my trip
        </button>
      </div>
    </section>
  );
}