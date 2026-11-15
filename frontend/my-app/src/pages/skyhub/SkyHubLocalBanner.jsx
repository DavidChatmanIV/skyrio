import React, { useEffect, useRef, useState } from "react";
import { MapPin, Plane, LocateFixed, X } from "lucide-react";
import { cityFromCoords, getPosition, locationError } from "@/lib/whereAmI";
import { tidyPlace } from "@/lib/placeName";

/* ─────────────────────────────────────────────────────────────
   SkyHubLocalBanner — "Landed somewhere new?"
   Skyrio's take on a "not your region?" prompt:
   • No city yet  → "Where are you exploring from?"
   • City set, and your device (if you already allowed location)
     says you're somewhere else → "Landed in Miami? Switch to Miami"
   • "Pick a city" opens an inline picker with trending places
   The city drives the Radar chip and the Nearby tab.
───────────────────────────────────────────────────────────── */

const DISMISS_KEY = "skyhub.localBanner.dismissed";

const sameCity = (a, b) =>
  a && b && a.name.toLowerCase() === b.name.toLowerCase();

export default function SkyHubLocalBanner({
  city,
  onCityChange,
  suggestions = [],
  openSignal = 0,
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [detected, setDetected] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);

  // The Radar's city chip asks us to open the picker.
  useEffect(() => {
    if (!openSignal) return;
    setDismissed(false);
    setPicking(true);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [openSignal]);

  // Only check location quietly if they've ALREADY allowed it — never
  // pop a permission prompt on page load.
  useEffect(() => {
    if (!city || dismissed) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await navigator.permissions?.query({
          name: "geolocation",
        });
        if (perm?.state !== "granted") return;
        const c = await getPosition(8000);
        const here = await cityFromCoords(c.latitude, c.longitude);
        if (!cancelled && !sameCity(here, city)) setDetected(here);
      } catch {
        /* quiet check — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setPicking(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* fine */
    }
  };

  const choose = (c) => {
    onCityChange?.(c);
    setDetected(null);
    setPicking(false);
    setTyped("");
    setError("");
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const c = await getPosition();
      choose(await cityFromCoords(c.latitude, c.longitude));
    } catch (e) {
      setError(locationError(e));
      setPicking(true);
      setTimeout(() => inputRef.current?.focus(), 30);
    } finally {
      setLocating(false);
    }
  };

  const submitTyped = () => {
    const name = tidyPlace(typed);
    if (!name) return;
    const [n, rest] = name.split(",").map((s) => s.trim());
    choose({
      name: n,
      region: rest || "",
      regionCode: (rest || "").toUpperCase(),
      label: name,
    });
  };

  const mismatch = city && detected && !sameCity(city, detected);
  const show = !dismissed && (picking || !city || mismatch);
  if (!show) return null;

  const firstName = (c) => c?.label || c?.name;

  return (
    <div className="shLocal" role="region" aria-label="Your SkyHub city">
      <div className="shLocal__stamp" aria-hidden="true">
        {mismatch ? <Plane size={20} /> : <MapPin size={20} />}
      </div>

      <div className="shLocal__body">
        {picking ? (
          <>
            <div className="shLocal__title">Where are you exploring?</div>
            <div className="shLocal__picker">
              <input
                ref={inputRef}
                className="shLocal__input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitTyped();
                  if (e.key === "Escape") setPicking(false);
                }}
                placeholder="City, e.g. Lisbon"
                aria-label="Your city"
                enterKeyHint="go"
              />
              <button
                type="button"
                className="shLocal__go"
                onClick={submitTyped}
                disabled={!typed.trim()}
              >
                Set
              </button>
            </div>
            {error && <div className="shLocal__error">{error}</div>}
            <div className="shLocal__chips">
              <button
                type="button"
                className="shLocal__chip is-gps"
                onClick={useMyLocation}
                disabled={locating}
              >
                <LocateFixed size={14} aria-hidden="true" />
                {locating ? "Finding you…" : "Use my location"}
              </button>
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="shLocal__chip"
                  onClick={() => choose({ name: s, label: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : mismatch ? (
          <>
            <div className="shLocal__title">Landed in {detected.name}?</div>
            <p className="shLocal__text">
              You're exploring SkyHub from {firstName(city)}. Switch to see
              tips, meetups and hidden gems travelers are sharing around you.
            </p>
            <div className="shLocal__actions">
              <button
                type="button"
                className="shLocal__primary"
                onClick={() => choose(detected)}
              >
                Switch to {detected.name}
              </button>
              <button
                type="button"
                className="shLocal__link"
                onClick={() => setPicking(true)}
              >
                Pick another city
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="shLocal__title">Where are you exploring from?</div>
            <p className="shLocal__text">
              Set your city and SkyHub will surface tips, meetups and hidden
              gems from travelers nearby.
            </p>
            <div className="shLocal__actions">
              <button
                type="button"
                className="shLocal__primary"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? "Finding you…" : "Use my location"}
              </button>
              <button
                type="button"
                className="shLocal__link"
                onClick={() => setPicking(true)}
              >
                Pick a city
              </button>
            </div>
            {error && <div className="shLocal__error">{error}</div>}
          </>
        )}
      </div>

      <button
        type="button"
        className="shLocal__close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
