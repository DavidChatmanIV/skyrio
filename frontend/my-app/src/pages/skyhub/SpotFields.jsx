// Spot details for a SkyHub post (a restaurant, a view, a shop…), used by
// the composer and Edit post, plus how a spot shows on a post.
// Same lists as cleanSpot() in backend/routes/api/skyhub.routes.js.
import React from "react";

export const SPOT_KINDS = [
  { key: "food", label: "Food" },
  { key: "drinks", label: "Drinks" },
  { key: "coffee", label: "Coffee" },
  { key: "sight", label: "Sight" },
  { key: "shop", label: "Shop" },
  { key: "activity", label: "Activity" },
  { key: "stay", label: "Stay" },
];
export const GOOD_FOR = [
  { key: "date_night", label: "Date night" },
  { key: "groups", label: "Groups" },
  { key: "solo", label: "Solo" },
  { key: "families", label: "Families" },
  { key: "quick_bite", label: "Quick bite" },
  { key: "late_night", label: "Late night" },
  { key: "views", label: "Views" },
  { key: "budget", label: "Budget" },
];
const MAX_GOOD_FOR = 3;
const PRICE_WORDS = ["Cheap", "Mid-range", "Pricey"];

export const EMPTY_SPOT = { name: "", kind: "", get: "", price: 0, cost: "", goodFor: [], area: "" };

/** A post's saved spot → form state. */
export const spotFromPost = (post) => ({
  name: post?.spot?.name || "",
  kind: post?.spot?.kind || "",
  get: post?.spot?.get || "",
  price: post?.spot?.price || 0,
  cost: post?.spot?.cost ? String(post.spot.cost) : "",
  goodFor: Array.isArray(post?.spot?.goodFor) ? post.spot.goodFor : [],
  area: post?.spot?.area || "",
});

/** Form state → what the server takes (empty name clears the spot). */
export const spotPayload = (s) => ({
  name: (s.name || "").trim(),
  kind: s.kind || undefined,
  get: (s.get || "").trim(),
  price: s.price || undefined,
  cost: Number(s.cost) > 0 ? Math.round(Number(s.cost)) : undefined,
  goodFor: s.goodFor?.length ? s.goodFor : [],
  area: (s.area || "").trim(),
});

export const spotChanged = (post, s) =>
  JSON.stringify(spotPayload(spotFromPost(post))) !== JSON.stringify(spotPayload(s));

export const spotHasExtras = (s) =>
  Boolean((s.get || "").trim() || s.price || s.cost || s.kind || s.goodFor?.length || (s.area || "").trim());

/** "Ramen Gami 🔥" → "Ramen Gami": a short first line that looks like a name. */
export function nameFromText(text) {
  const first = String(text || "").split("\n")[0];
  const clean = first
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "")
    .replace(/[!?.,:;#]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length < 2 || clean.length > 40) return "";
  if (clean.split(" ").length > 5) return "";
  return clean;
}

const getLabel = (kind) =>
  ({ food: "What to order", drinks: "What to order", coffee: "What to order", shop: "What to get" }[kind] ||
  (kind ? "Tip" : "What to get"));
const getPlaceholder = (kind) =>
  ({
    food: "e.g. Tonkotsu ramen",
    drinks: "e.g. Passion fruit mojito",
    coffee: "e.g. Iced oat latte",
    sight: "e.g. Go at sunset",
    shop: "e.g. Local hot sauce",
    activity: "e.g. Book a morning slot",
    stay: "e.g. Ask for an ocean view",
  }[kind] || "Optional");

/**
 * The form. onChange gets an updater fn, like a useState setter.
 * keepFocus: stop taps from blurring the composer (it collapses on blur).
 */
export function SpotFields({ spot, onChange, text = "", idPrefix = "spot", keepFocus = false }) {
  const set = (k, v) => onChange((sp) => ({ ...sp, [k]: v }));
  const hold = keepFocus ? { onMouseDown: (e) => e.preventDefault() } : {};
  const suggestion = !spot.name.trim() ? nameFromText(text) : "";
  const toggleGood = (key) =>
    onChange((sp) => {
      const has = sp.goodFor.includes(key);
      if (!has && sp.goodFor.length >= MAX_GOOD_FOR) return sp;
      return { ...sp, goodFor: has ? sp.goodFor.filter((g) => g !== key) : [...sp.goodFor, key] };
    });

  return (
    <div className="shSpotF">
      <div className="shSpotF__group" role="radiogroup" aria-label="Kind of spot">
        {SPOT_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={spot.kind === k.key}
            className={`shSpotF__chip${spot.kind === k.key ? " is-on" : ""}`}
            {...hold}
            onClick={() => set("kind", spot.kind === k.key ? "" : k.key)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label className="shCmp-spotField">
        <span>Spot name</span>
        <input
          value={spot.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Ramen Gami"
          maxLength={80}
          autoComplete="off"
        />
      </label>
      {suggestion && (
        <button type="button" className="shSpotF__suggest" {...hold} onClick={() => set("name", suggestion)}>
          Use &ldquo;{suggestion}&rdquo;
        </button>
      )}

      <label className="shCmp-spotField">
        <span>{getLabel(spot.kind)}</span>
        <input
          value={spot.get}
          onChange={(e) => set("get", e.target.value)}
          placeholder={getPlaceholder(spot.kind)}
          maxLength={120}
          autoComplete="off"
        />
      </label>

      <div className="shCmp-spotRow">
        <div className="shCmp-spotField">
          <span id={`${idPrefix}-price`}>Price</span>
          <div className="shCmp-price" role="radiogroup" aria-labelledby={`${idPrefix}-price`}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={spot.price === n}
                aria-label={PRICE_WORDS[n - 1]}
                className={spot.price === n ? "is-on" : ""}
                {...hold}
                onClick={() => set("price", spot.price === n ? 0 : n)}
              >
                {"$".repeat(n)}
              </button>
            ))}
          </div>
        </div>
        <label className="shCmp-spotField">
          <span>Paid per person</span>
          <div className="shSpotF__money">
            <i aria-hidden="true">$</i>
            <input
              value={spot.cost}
              onChange={(e) => set("cost", e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="Optional"
              aria-label="About how much per person, in dollars"
              autoComplete="off"
            />
          </div>
        </label>
      </div>

      <div className="shCmp-spotField">
        <span>Good for (up to {MAX_GOOD_FOR})</span>
        <div className="shSpotF__group">
          {GOOD_FOR.map((g) => {
            const on = spot.goodFor.includes(g.key);
            const full = !on && spot.goodFor.length >= MAX_GOOD_FOR;
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={on}
                disabled={full}
                className={`shSpotF__chip${on ? " is-on" : ""}`}
                {...hold}
                onClick={() => toggleGood(g.key)}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="shCmp-spotField">
        <span>Area or street</span>
        <input
          value={spot.area}
          onChange={(e) => set("area", e.target.value)}
          placeholder="Optional, e.g. Ironbound"
          maxLength={80}
          autoComplete="off"
        />
      </label>
    </div>
  );
}

const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/** How a spot shows on a post. */
export function SpotView({ spot, destination = "" }) {
  if (!spot?.name) return null;
  const kind = SPOT_KINDS.find((k) => k.key === spot.kind);
  const good = (spot.goodFor || []).map((g) => GOOD_FOR.find((x) => x.key === g)?.label).filter(Boolean);
  const where = [spot.name, spot.area, destination].filter(Boolean).join(", ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;
  const priceBits = [
    spot.price ? "$".repeat(spot.price) : "",
    spot.cost ? `about $${spot.cost} per person` : "",
  ].filter(Boolean);
  return (
    <div className="skyhub-spot" aria-label="Spot">
      <div className="skyhub-spot__head">
        <div className="skyhub-spot__name">{spot.name}</div>
        {kind && <span className="skyhub-spot__kind">{kind.label}</span>}
      </div>
      {(spot.get || priceBits.length) && (
        <div className="skyhub-spot__row">
          {spot.get && (
            <span>
              <span className="skyhub-spot__label">{getLabel(spot.kind) === "Tip" ? "Tip" : "Get"}</span>
              <span>{spot.get}</span>
            </span>
          )}
          {priceBits.length > 0 && (
            <span>
              <span className="skyhub-spot__label">Price</span>
              <span aria-label={spot.price ? `${PRICE_WORDS[spot.price - 1]}${spot.cost ? `, about $${spot.cost} per person` : ""}` : undefined}>
                {priceBits.join(" · ")}
              </span>
            </span>
          )}
        </div>
      )}
      {good.length > 0 && (
        <div className="skyhub-spot__good">
          {good.map((g) => (
            <span key={g} className="skyhub-spot__tag">
              {g}
            </span>
          ))}
        </div>
      )}
      <div className="skyhub-spot__foot">
        {spot.area && <span className="skyhub-spot__area">{spot.area}</span>}
        <a className="skyhub-spot__map" href={mapUrl} target="_blank" rel="noopener noreferrer">
          <PinIcon /> Open in Maps
        </a>
      </div>
    </div>
  );
}
