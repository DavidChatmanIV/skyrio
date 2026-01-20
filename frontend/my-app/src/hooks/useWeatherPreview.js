import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Open-Meteo (no API key) weather preview
 * - current temp + weathercode
 * - today's hi/lo
 * - simple 10 min cache (in-memory)
 */

const CACHE = new Map(); // key -> { ts, data }
const TTL_MS = 10 * 60 * 1000;

function codeToLabel(code) {
  // Open-Meteo weather codes (simplified)
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers";
  if ([95, 96, 99].includes(code)) return "Thunder";
  return "Weather";
}

function codeToEmoji(code) {
  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
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
  });

  const abortRef = useRef(null);

  useEffect(() => {
    if (lat == null || lon == null) return;

    // cache hit
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setState({ loading: false, ...cached.data });
      return;
    }

    // abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true }));

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto`;

    fetch(url, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Bad response"))
      )
      .then((json) => {
        const temp = Math.round(json?.current?.temperature_2m);
        const code = json?.current?.weather_code;

        const high = Math.round(json?.daily?.temperature_2m_max?.[0]);
        const low = Math.round(json?.daily?.temperature_2m_min?.[0]);

        const data = {
          temp: Number.isFinite(temp) ? temp : null,
          high: Number.isFinite(high) ? high : null,
          low: Number.isFinite(low) ? low : null,
          label: codeToLabel(code),
          emoji: codeToEmoji(code),
        };

        CACHE.set(key, { ts: Date.now(), data });
        setState({ loading: false, ...data });
      })
      .catch(() => {
        // Fail silently for landing page polish (don’t show errors here)
        setState({
          loading: false,
          temp: null,
          high: null,
          low: null,
          label: "",
          emoji: "🌡️",
        });
      });

    return () => controller.abort();
  }, [key, lat, lon]);

  return state;
}