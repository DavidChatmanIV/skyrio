import React, { useMemo } from "react";

const DEMO_POSTS = [
  {
    id: "p1",
    name: "Peter Chen",
    handle: "@petertravels",
    verified: true,
    text: "Hidden gem! 🌿 Discovered this quiet trail in Kyoto away from the crowd. Peaceful and beautiful.",
    tags: ["Kyoto", "HiddenGem"],
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=70",
  },
  {
    id: "p2",
    name: "Emma Walker",
    handle: "@emmawanders",
    verified: true,
    text: "Sunset views from our rooftop in Barcelona 🌇🧡",
    tags: ["Barcelona", "TravelMoments"],
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=70",
  },
];

export default function MomentsFeed({ filter = "Friends" }) {
  const posts = useMemo(() => {
    // Phase-1: same sample posts for now.
    // Phase-2: swap this with real data + filter logic.
    return DEMO_POSTS;
  }, []);

  return (
    <section className="sh-feed">
      <div className="sh-feedNotice">
        SkyHub is in demo mode (API not available). Showing sample Moments.
      </div>

      <div className="sh-feedList">
        {posts.map((p) => (
          <article key={p.id} className="sh-post">
            <header className="sh-postHeader">
              <div className="sh-postUser">
                <div className="sh-avatar" aria-hidden="true" />
                <div>
                  <div className="sh-nameRow">
                    <span className="sh-name">{p.name}</span>
                    {p.verified && <span className="sh-badge">verified</span>}
                  </div>
                  <div className="sh-handle">{p.handle}</div>
                </div>
              </div>

              <button
                className="sh-moreBtn"
                type="button"
                aria-label="More options"
              >
                •••
              </button>
            </header>

            <div className="sh-postBody">
              <p className="sh-text">{p.text}</p>

              <div className="sh-tags">
                {p.tags.map((t) => (
                  <span key={t} className="sh-tag">
                    #{t}
                  </span>
                ))}
              </div>

              <div className="sh-media">
                <img src={p.image} alt="" loading="lazy" />
              </div>
            </div>

            <footer className="sh-postFooter">
              <button className="sh-action" type="button">
                ♡
              </button>
              <button className="sh-action" type="button">
                💬
              </button>
              <button className="sh-action" type="button">
                ↗
              </button>
              <span className="sh-spacer" />
              <button className="sh-action" type="button">
                💾 Save
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}