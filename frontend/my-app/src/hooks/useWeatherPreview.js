import { useEffect, useMemo, useRef, useState } from "react";

/**
 * OpenWeather-backed preview:
 * - current temp + condition
 * - today's hi/lo at the destination
 * - destination's LOCAL time (not the visitor's browser time)
 * - 10 min in-memory cache
 *
 * Calls YOUR backend proxy (/api/weather/preview), never OpenWeather directly.
 */

const CACHE = new Map(); // key -> { ts, data }
const TTL_MS = 10 * 60 * 1000;

function codeToLabel(code) {
  if (code === 800) return "Clear";
  if (code > 800) return "Cloudy";
  if (code >= 700) return "Fog/Haze";
  if (code >= 600) return "Snow";
  if (code >= 500) return "Rain";
  if (code >= 300) return "Drizzle";
  if (code >= 200) return "Thunder";
  return "Weather";
}

function codeToEmoji(code) {
  if (code === 800) return "☀️";
  if (code > 800) return "⛅";
  if (code >= 700) return "🌫️";
  if (code >= 600) return "❄️";
  if (code >= 500) return "🌧️";
  if (code >= 300) return "🌦️";
  if (code >= 200) return "⛈️";
  return "🌡️";
}

export function useWeatherPreview(lat, lon) {
  const key = useMemo(() => `${lat},${lon}`, [lat, lon]);
  const [state, setState] = useState({
    loading: true,
    temp: null,
    high: null,
    low: null,
    label: "",
    emoji: "🌡️",
    localTime: null,
  });

  const abortRef = useRef(null);

  useEffect(() => {
    if (lat == null || lon == null) return;

    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setState({ loading: false, ...cached.data });
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true }));

    const url = `/api/weather/preview?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}`;

    fetch(url, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Bad response"))
      )
      .then((json) => {
        if (!json.success) throw new Error(json.message || "Weather error");

        const data = {
          temp: Number.isFinite(json.temp) ? json.temp : null,
          high: Number.isFinite(json.high) ? json.high : null,
          low: Number.isFinite(json.low) ? json.low : null,
          label: codeToLabel(json.code),
          emoji: codeToEmoji(json.code),
          localTime: json.localTimeIso
            ? new Date(json.localTimeIso).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC", // ISO string is pre-shifted to destination local time
              })
            : null,
        };

        CACHE.set(key, { ts: Date.now(), data });
        setState({ loading: false, ...data });
      })
      .catch(() => {
        setState({
          loading: false,
          temp: null,
          high: null,
          low: null,
          label: "",
          emoji: "🌡️",
          localTime: null,
        });
      });

    return () => controller.abort();
  }, [key, lat, lon]);

  return state;
}
