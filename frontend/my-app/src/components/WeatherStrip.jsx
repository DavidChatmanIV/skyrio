// ─────────────────────────────────────────────────────────────
// WeatherStrip — real weather for a destination, used on:
//   - the booking page ("Your pass" box), once a destination is picked
//   - the Sync Together trip page
//
// Data: GET /api/weather?city=…  (OpenWeather, free plan)
//   current          what it's like there right now
//   forecast         about 5 days ahead (the free plan's limit)
//   forecastThrough  the last day covered
//
// What it shows:
//   - trip dates inside the forecast  → those days, highlighted
//   - trip further out than that      → "right now" + when the forecast
//                                       will show up. Never made-up averages.
//   - no dates yet                    → the next few days
// If the city can't be found or the service is down, it shows nothing.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Umbrella,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const FORECAST_DAYS = 5;

// One request per city per visit, shared by every strip on the page.
const memo = new Map(); // city → Promise<data|null>
function loadWeather(city) {
  const key = city.toLowerCase();
  if (!memo.has(key)) {
    memo.set(
      key,
      fetch(`${API}/api/weather?city=${encodeURIComponent(city)}&days=5`)
        .then((r) => r.json())
        .then((d) => (d?.success && d.forecast?.length ? d : null))
        .catch(() => null)
        .then((d) => {
          if (!d) memo.delete(key); // try again next time
          return d;
        })
    );
  }
  return memo.get(key);
}

// "Miami (MIA)", "Miami, FL, USA" → "Miami, FL"; airport codes alone are
// left as they are (they may not be found, and then nothing shows).
export function weatherCityName(raw) {
  return String(raw || "")
    .replace(/\(.*?\)/g, "")
    .split(",")
    .slice(0, 2)
    .join(",")
    .trim();
}

function iconFor(code, size = 18) {
  const c = Number(code);
  const p = { size, "aria-hidden": true };
  if (c === 800) return <Sun {...p} color="#ffb347" />;
  if (c > 800) return <Cloud {...p} color="#d9cffc" />;
  if (c >= 700) return <CloudFog {...p} color="#d9cffc" />;
  if (c >= 600) return <CloudSnow {...p} color="#e0f2fe" />;
  if (c >= 500) return <CloudRain {...p} color="#7dd3fc" />;
  if (c >= 300) return <CloudDrizzle {...p} color="#7dd3fc" />;
  if (c >= 200) return <CloudLightning {...p} color="#fcd34d" />;
  return <Sun {...p} color="#ffb347" />;
}

const toDay = (v) => {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d.startOf("day") : null;
};

const CSS = `
.wx { color: #fff; }
.wx--card {
  position: relative; overflow: hidden; padding: 12px 14px; border-radius: 16px;
  background: linear-gradient(160deg, rgba(74,40,112,.55) 0%, rgba(34,18,62,.62) 100%);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1);
}
.wx-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.wx-title { font-size: 12px; font-weight: 800; letter-spacing: .04em; color: rgba(255,255,255,.85);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.wx-now { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  font-size: 12.5px; color: rgba(255,255,255,.8); }
.wx-now b { color: #fff; font-size: 14px; }
.wx-days { display: grid; grid-template-columns: repeat(var(--wx-n, 5), minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.wx-day { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 2px;
  border-radius: 11px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); min-width: 0; }
.wx-day.is-trip { background: rgba(255,138,42,.14); border-color: rgba(255,179,71,.5); }
.wx-dow { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.75); }
.wx-hi { font-size: 13.5px; font-weight: 800; }
.wx-lo { font-size: 11px; color: rgba(255,255,255,.6); }
.wx-rain { display: inline-flex; align-items: center; gap: 2px; font-size: 10.5px; color: #7dd3fc; min-height: 13px; }
.wx-note { margin-top: 8px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,.7); }
.wx-note b { color: #ffb347; font-weight: 700; }
.wx-skel { height: 64px; margin-top: 10px; border-radius: 11px; background: rgba(255,255,255,.05); }
`;

export default function WeatherStrip({
  city,
  start = null,
  end = null,
  variant = "card", // "card" (own box) | "plain" (inside another section)
  showTitle = true,
}) {
  const name = weatherCityName(city);
  const [data, setData] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!name || name.length < 2) {
      setData(null);
      return undefined;
    }
    let alive = true;
    setData(undefined);
    // Small pause so typing a city doesn't fire a request per letter.
    const t = setTimeout(() => {
      loadWeather(name).then((d) => alive && setData(d));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name]);

  if (!name || data === null) return null;

  const tripStart = toDay(start);
  const tripEnd = toDay(end) || tripStart;
  const today = dayjs().startOf("day");
  const last = data ? toDay(data.forecastThrough) : null;

  // Which days to show, and whether they're trip days.
  let days = data?.forecast || [];
  let mode = "next"; // next | trip | later | past
  if (tripStart && data) {
    if (tripEnd && tripEnd.isBefore(today)) mode = "past";
    else if (last && tripStart.isAfter(last)) mode = "later";
    else {
      mode = "trip";
      const inTrip = days.filter((d) => {
        const dd = toDay(d.date);
        return !dd.isBefore(tripStart) && !dd.isAfter(tripEnd);
      });
      if (inTrip.length) days = inTrip;
    }
  }
  const isTrip = (d) =>
    mode === "trip" &&
    tripStart &&
    !toDay(d.date).isBefore(tripStart) &&
    !toDay(d.date).isAfter(tripEnd);

  const showDays = mode === "next" || mode === "trip";
  const shown = days.slice(0, FORECAST_DAYS);
  const placeLabel = data?.city || name.split(",")[0];

  // When the trip's forecast will appear: about 5 days before it starts.
  const availableOn =
    mode === "later" ? tripStart.subtract(FORECAST_DAYS - 1, "day") : null;

  return (
    <div
      className={`wx${variant === "card" ? " wx--card" : ""}`}
      aria-label={`Weather in ${placeLabel}`}
    >
      <style>{CSS}</style>
      <div className="wx-head">
        {showTitle && (
          <span className="wx-title">
            {mode === "trip"
              ? "Weather on your trip"
              : `Weather in ${placeLabel}`}
          </span>
        )}
        {data?.current && (
          <span className="wx-now" title="Right now">
            {iconFor(data.current.code, 15)}
            <span>
              Now <b>{data.current.temp}°</b>
            </span>
          </span>
        )}
      </div>

      {data === undefined ? (
        <div className="wx-skel" aria-hidden="true" />
      ) : showDays ? (
        <div className="wx-days" style={{ "--wx-n": shown.length }}>
          {shown.map((d) => {
            const dd = toDay(d.date);
            const label = dd.isSame(today) ? "Today" : dd.format("ddd");
            return (
              <div
                key={d.date}
                className={`wx-day${isTrip(d) ? " is-trip" : ""}`}
                title={`${dd.format("ddd, MMM D")}: ${d.condition}, high ${
                  d.high
                }°, low ${d.low}°${
                  d.rainChance ? `, ${d.rainChance}% chance of rain` : ""
                }`}
              >
                <span className="wx-dow">{label}</span>
                {iconFor(d.code)}
                <span className="wx-hi">{d.high}°</span>
                <span className="wx-lo">{d.low}°</span>
                <span className="wx-rain">
                  {d.rainChance >= 20 && (
                    <>
                      <Umbrella size={9} aria-hidden="true" />
                      {d.rainChance}%
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : mode === "later" ? (
        <div className="wx-note">
          Your trip&apos;s forecast shows up around{" "}
          <b>{availableOn.format("MMM D")}</b>. Forecasts only reach about{" "}
          {FORECAST_DAYS} days ahead.
        </div>
      ) : null}

      {mode === "trip" &&
        tripEnd &&
        last &&
        tripEnd.isAfter(last) &&
        data !== undefined && (
          <div className="wx-note">
            The rest of your trip shows up closer to the date.
          </div>
        )}
    </div>
  );
}
