import React, { useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   SkyHubSearch — "SkyHub Radar"
   • Split-flap placeholder that cycles through real trending
     destinations, like an airport departures board
   • Scope switch: Everything / Places / Tips / Travelers
   • Live suggestions built from posts already on the page
     (places, travelers, tags) with arrow-key navigation
   • "/" anywhere on the page jumps into search
───────────────────────────────────────────────────────────── */

const SCOPES = [
  { value: "all", label: "Everything" },
  { value: "places", label: "Places" },
  { value: "tips", label: "Tips" },
  { value: "travelers", label: "Travelers" },
];

const FALLBACK_PLACES = [
  "Tokyo",
  "Lisbon",
  "Miami",
  "Bali",
  "Mexico City",
  "Paris",
];
const FLAP_MS = 2600;

const RadarIcon = ({ spinning }) => (
  <svg
    className={`shRadar__icon${spinning ? " is-spinning" : ""}`}
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9.5"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.5"
    />
    <circle
      cx="12"
      cy="12"
      r="5.5"
      stroke="currentColor"
      strokeOpacity="0.55"
      strokeWidth="1.5"
    />
    <path
      className="shRadar__sweep"
      d="M12 12 L12 2.5 A9.5 9.5 0 0 1 20.2 7.2 Z"
      fill="currentColor"
      fillOpacity="0.35"
    />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
  </svg>
);

function SplitFlap({ text }) {
  // Re-keying on text restarts the flip animation for every letter.
  return (
    <span className="shRadar__flap" aria-hidden="true" key={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="shRadar__flapChar"
          style={{ animationDelay: `${i * 35}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export default function SkyHubSearch({
  value,
  onChange,
  scope = "all",
  onScopeChange,
  onSubmit,
  posts = [],
  trending = [],
  resultCount,
  city = null,
  onCityClick,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [flapIndex, setFlapIndex] = useState(0);

  const places = useMemo(() => {
    const names = trending.map((t) => t.name).filter(Boolean);
    return names.length >= 3
      ? names
      : [...new Set([...names, ...FALLBACK_PLACES])];
  }, [trending]);

  // Departures-board placeholder
  useEffect(() => {
    if (value || focused) return undefined;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return undefined;
    const t = setInterval(
      () => setFlapIndex((i) => (i + 1) % places.length),
      FLAP_MS
    );
    return () => clearInterval(t);
  }, [value, focused, places.length]);

  // "/" jumps to search, like most power-user tools
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (
        e.key === "/" &&
        !["input", "textarea", "select"].includes(tag) &&
        !e.target?.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close suggestions when clicking away
  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Suggestions from what's already loaded — instant, no extra requests
  const groups = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const count = (map, key, extra) => {
      if (!key) return;
      const k = key.toLowerCase();
      const cur = map.get(k) || { label: key, n: 0, ...extra };
      cur.n += 1;
      map.set(k, cur);
    };
    const placesMap = new Map();
    const peopleMap = new Map();
    const tagsMap = new Map();
    posts.forEach((p) => {
      count(placesMap, p.destination?.trim());
      count(peopleMap, p.author, { sub: p.username, avatar: p.avatar });
      (p.tags || []).forEach((t) => count(tagsMap, t.replace(/^#/, "")));
    });
    const match = (map) =>
      [...map.values()]
        .filter(
          (x) =>
            x.label.toLowerCase().includes(q) ||
            (x.sub || "").toLowerCase().includes(q)
        )
        .sort((a, b) => b.n - a.n)
        .slice(0, 4);

    const out = [];
    if (scope === "all" || scope === "places")
      out.push({
        key: "places",
        title: "Places",
        scope: "places",
        icon: "📍",
        items: match(placesMap),
      });
    if (scope === "all" || scope === "travelers")
      out.push({
        key: "travelers",
        title: "Travelers",
        scope: "travelers",
        icon: "🧳",
        items: match(peopleMap),
      });
    if (scope === "all" || scope === "tips")
      out.push({
        key: "tags",
        title: "Topics",
        scope: "tips",
        icon: "#",
        items: match(tagsMap),
      });
    return out.filter((g) => g.items.length);
  }, [value, posts, scope]);

  const flat = useMemo(
    () => groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g }))),
    [groups]
  );

  useEffect(() => setActive(-1), [value, scope]);

  const pick = (item) => {
    onChange(item.label);
    if (scope === "all" && item.group?.scope) onScopeChange?.(item.group.scope);
    setOpen(false);
    onSubmit?.();
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && flat[active]) pick(flat[active]);
      else {
        setOpen(false);
        onSubmit?.();
      }
    } else if (e.key === "Escape") {
      if (value) onChange("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  };

  const showFlap = !value && !focused;
  const placeholder = focused
    ? scope === "travelers"
      ? "Search by name or @handle"
      : scope === "places"
      ? city
        ? `Places near ${city.name} or anywhere`
        : "City, country or region"
      : scope === "tips"
      ? "Food, safety, budget…"
      : "Where, who or what?"
    : "";
  let row = -1;

  return (
    <div className={`shRadar${focused ? " is-focused" : ""}`} ref={wrapRef}>
      <div className="shRadar__top">
        <span className="shRadar__labelWrap">
          <span className="shRadar__label">
            <span className="shRadar__ping" aria-hidden="true" />
            SkyHub Radar
          </span>
          <span className="shRadar__meta">
            {value && typeof resultCount === "number"
              ? `${resultCount} match${resultCount === 1 ? "" : "es"}`
              : `${posts.length} live post${posts.length === 1 ? "" : "s"}`}
          </span>
        </span>
        {onCityClick && (
          <button
            type="button"
            className={`shRadar__city${city ? "" : " is-empty"}`}
            onClick={onCityClick}
            title={city ? "Change your city" : "Set your city"}
          >
            <span aria-hidden="true">📍</span>
            <span className="shRadar__cityName">
              {city ? city.label || city.name : "Set city"}
            </span>
            <span aria-hidden="true" className="shRadar__cityCaret">
              ▾
            </span>
          </button>
        )}
      </div>

      <div className="shRadar__field" onClick={() => inputRef.current?.focus()}>
        <RadarIcon spinning={focused || !!value} />
        <div className="shRadar__inputWrap">
          {showFlap && (
            <span className="shRadar__placeholder">
              <span className="shRadar__prefix">Search</span>
              <SplitFlap text={places[flapIndex % places.length]} />
            </span>
          )}
          <input
            ref={inputRef}
            className="shRadar__input"
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            aria-label="Search SkyHub"
            role="combobox"
            aria-expanded={open && flat.length > 0}
            aria-controls="shRadar-list"
            aria-activedescendant={
              active >= 0 ? `shRadar-opt-${active}` : undefined
            }
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {value ? (
          <button
            type="button"
            className="shRadar__clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : (
          <kbd className="shRadar__kbd" title="Press / to search">
            /
          </kbd>
        )}
      </div>

      <div className="shRadar__scopes" role="radiogroup" aria-label="Search in">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={scope === s.value}
            className={`shRadar__scope${scope === s.value ? " is-on" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onScopeChange?.(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!value && trending.length > 0 && (
        <div className="shRadar__trending">
          <span className="shRadar__trendLabel">Now boarding</span>
          {trending.slice(0, 3).map((t) => (
            <button
              key={t.name}
              type="button"
              className="shRadar__trendChip"
              onClick={() => {
                onChange(t.name);
                onScopeChange?.("places");
                onSubmit?.();
              }}
            >
              {t.name}
              <span>{t.posts}</span>
            </button>
          ))}
        </div>
      )}

      {open && value.trim() && (
        <div className="shRadar__drop" id="shRadar-list" role="listbox">
          {groups.length ? (
            groups.map((g) => (
              <div key={g.key} className="shRadar__group">
                <div className="shRadar__groupTitle">{g.title}</div>
                {g.items.map((it) => {
                  row += 1;
                  const idx = row;
                  return (
                    <div
                      key={it.label}
                      id={`shRadar-opt-${idx}`}
                      role="option"
                      aria-selected={active === idx}
                      className={`shRadar__opt${
                        active === idx ? " is-active" : ""
                      }`}
                      onMouseEnter={() => setActive(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(it);
                      }}
                    >
                      <span className="shRadar__optIcon" aria-hidden="true">
                        {g.key === "travelers" &&
                        typeof it.avatar === "string" &&
                        it.avatar.startsWith("http") ? (
                          <img src={it.avatar} alt="" />
                        ) : (
                          g.icon
                        )}
                      </span>
                      <span className="shRadar__optText">
                        <span className="shRadar__optLabel">
                          {g.key === "tags" ? `#${it.label}` : it.label}
                        </span>
                        {it.sub && (
                          <span className="shRadar__optSub">{it.sub}</span>
                        )}
                      </span>
                      <span className="shRadar__optCount">
                        {it.n} post{it.n === 1 ? "" : "s"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="shRadar__none">
              Nothing on the radar for “{value.trim()}” yet.
              <span>Be the first to post about it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
