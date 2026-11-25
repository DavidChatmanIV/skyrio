// A small, still map: a dashed line from the home airport to the trip's
// destination. Not interactive (no drag/zoom), so it never gets in the way
// of scrolling. Used on the "Can't decide?" trip card when Skyrio has a
// real fare for the trip (the fare scan knows both ends of the route).
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CSS = `
.mrm { position: relative; height: 120px; border-radius: 14px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.12); background: #1a1233; margin-top: 12px; }
.mrm .leaflet-container { height: 100%; width: 100%; background: #1a1233; cursor: default; }
.mrm .leaflet-tile-pane { filter: invert(1) hue-rotate(200deg) brightness(0.85) contrast(0.9) saturate(0.6); }
.mrm .leaflet-control-attribution { font-size: 9px; background: rgba(20,12,36,.7); color: rgba(255,255,255,.6); }
.mrm .leaflet-control-attribution a { color: rgba(255,255,255,.75); }
`;

export default function MiniRouteMap({ from, to, label }) {
  const el = useRef(null);
  useEffect(() => {
    if (!el.current || !Array.isArray(from) || !Array.isArray(to)) return;
    const map = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 8,
    }).addTo(map);
    L.polyline([from, to], { color: "#ff8a2a", weight: 2.5, opacity: 0.95, dashArray: "6 6" }).addTo(map);
    L.circleMarker(from, { radius: 4, color: "#ffffff", weight: 2, fillColor: "#7c5cfc", fillOpacity: 1 }).addTo(map);
    L.circleMarker(to, { radius: 6, color: "#ffffff", weight: 2, fillColor: "#ff8a2a", fillOpacity: 1 }).addTo(map);
    map.fitBounds(L.latLngBounds([from, to]), { padding: [22, 22], maxZoom: 6 });
    const fix = setTimeout(() => map.invalidateSize(), 0);
    return () => {
      clearTimeout(fix);
      map.remove();
    };
  }, [from?.[0], from?.[1], to?.[0], to?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  return (
    <div className="mrm" role="img" aria-label={label}>
      <style>{CSS}</style>
      <div ref={el} style={{ height: "100%" }} />
    </div>
  );
}
