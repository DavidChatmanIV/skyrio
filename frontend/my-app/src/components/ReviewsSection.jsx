import { useEffect, useState } from "react";
import { Star, Sparkles, Quote, MapPin } from "lucide-react";

/**
 * Homepage reviews section.
 *
 *   <ReviewsSection />
 *
 * Shows reviews you've FEATURED in Admin → Feedback & reviews. If you
 * haven't featured any yet, it shows the newest approved ones instead.
 * The average rating at the top always counts EVERY approved review, good
 * or bad, and the XP disclosure is always shown. Both keep this fair.
 *
 * Hides itself completely until there's at least one approved review,
 * so nothing looks empty before launch.
 */

const API = import.meta.env.VITE_API_URL || "";

function Stars({ value, size = 15 }) {
  return (
    <span
      className="rvs__stars"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= Math.round(value) ? "#ff8a2a" : "none"}
          color={n <= Math.round(value) ? "#ff8a2a" : "rgba(255,255,255,0.22)"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function ReviewsSection({
  title = "What travelers say",
  limit = 6,
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const get = (q) =>
          fetch(`${API}/api/testimonials/public?${q}`).then((r) => r.json());
        let j = await get(`featured=1&limit=${limit}`);
        // Nothing featured yet → fall back to the newest approved reviews.
        if (j.ok && !j.testimonials?.length) j = await get(`limit=${limit}`);
        if (alive && j.ok) setData(j);
      } catch {
        // Section just stays hidden if the API is unreachable.
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit]);

  if (!data || !data.testimonials?.length) return null;

  const { summary, testimonials, disclosure } = data;

  return (
    <section className="rvs" aria-labelledby="rvs-title">
      <style>{css}</style>

      <div className="rvs__head">
        <h2 id="rvs-title" className="rvs__title">
          {title}
        </h2>
        {summary?.averageRating != null && (
          <div className="rvs__summary">
            <span className="rvs__avg">{summary.averageRating.toFixed(1)}</span>
            <div>
              <Stars value={summary.averageRating} size={16} />
              <div className="rvs__count">
                from {summary.count}{" "}
                {summary.count === 1 ? "review" : "reviews"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rvs__grid">
        {testimonials.map((t) => (
          <figure key={t.id} className="rvs__card">
            <Quote className="rvs__quote" size={22} aria-hidden="true" />
            <Stars value={t.rating} />
            <blockquote className="rvs__text">{t.text}</blockquote>
            <figcaption className="rvs__who">
              <span className="rvs__avatar" aria-hidden="true">
                {initials(t.name) || "S"}
              </span>
              <span>
                <span className="rvs__name">{t.name}</span>
                {t.city && (
                  <span className="rvs__city">
                    <MapPin size={11} aria-hidden="true" />
                    {t.city}
                  </span>
                )}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="rvs__disclosure">
        <Sparkles size={12} aria-hidden="true" />
        {disclosure ||
          "Reviewers earn Skyrio XP for leaving a review, whatever their rating."}{" "}
        Every review comes from a signed-in Skyrio account.
      </p>
    </section>
  );
}

const css = `
.rvs {
  font-family: 'DM Sans', sans-serif;
  color: #fff;
  max-width: 1200px;
  margin: 0 auto;
  padding: 64px 24px;
  box-sizing: border-box;
}
.rvs__head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 20px; flex-wrap: wrap; margin-bottom: 28px;
}
.rvs__title {
  margin: 0; font-size: clamp(26px, 4vw, 38px); font-weight: 800; letter-spacing: -0.02em;
}
.rvs__summary { display: flex; align-items: center; gap: 12px; }
.rvs__avg { font-size: 40px; font-weight: 800; line-height: 1; color: #ffb347; }
.rvs__count { font-size: 12.5px; color: rgba(255,255,255,0.55); margin-top: 4px; }
.rvs__stars { display: inline-flex; gap: 2px; }
.rvs__grid {
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
.rvs__card {
  position: relative; margin: 0; padding: 22px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.rvs__quote { position: absolute; top: 18px; right: 18px; color: rgba(255,138,42,0.25); }
.rvs__text {
  margin: 0; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.85);
  flex: 1; overflow-wrap: anywhere;
}
.rvs__who { display: flex; align-items: center; gap: 10px; }
.rvs__avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, #ff8a2a, #7c5cfc);
}
.rvs__name { display: block; font-size: 14px; font-weight: 700; }
.rvs__city {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: rgba(255,255,255,0.5);
}
.rvs__disclosure {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  flex-wrap: wrap; text-align: center;
  margin: 24px 0 0; font-size: 12px; color: rgba(255,255,255,0.45);
}
.rvs__disclosure svg { color: #ffb347; flex-shrink: 0; }
@media (max-width: 600px) {
  .rvs { padding: 44px 16px; }
  .rvs__grid { grid-template-columns: 1fr; }
}
`;
