// Car rental results (Duffel Cars) + checkout. Rendered in BookingPage's
// results column when the Cars tab has a search.
import { useEffect, useMemo, useState } from "react";
import CarCheckout from "./CarCheckout";
import "@/styles/cars.css";

const API = import.meta.env.VITE_API_URL || "";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "small", label: "Small", match: (c) => /mini|economy|compact/i.test(c.car.category || "") },
  { id: "mid", label: "Midsize & full-size", match: (c) => /midsize|standard|full/i.test(c.car.category || "") && c.car.type !== "SUV" },
  { id: "suv", label: "SUVs", match: (c) => c.car.type === "SUV" },
  { id: "van", label: "Vans & trucks", match: (c) => /van|pickup/i.test(c.car.type || "") },
  { id: "premium", label: "Premium & luxury", match: (c) => /premium|luxury/i.test(c.car.category || "") },
];

export const money = (n, cur = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);

const SeatIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="7" r="4" /><path d="M4 21v-1a7 7 0 0 1 16 0v1" />
  </svg>
);
const BagIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="5" y="7" width="14" height="13" rx="2" /><path d="M9 7V4h6v3" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);

export function CarCard({ c, onSelect, extra = null }) {
  return (
    <article className="sk-car-card">
      <div className="sk-car-media">
        {c.car.image ? <img src={c.car.image} alt="" loading="lazy" /> : <div className="sk-car-media-empty" />}
        {c.supplier.logo && <img className="sk-car-logo" src={c.supplier.logo} alt={c.supplier.name} />}
      </div>
      <div className="sk-car-body">
        <div className="sk-car-kicker">
          {[c.car.category, c.car.type].filter(Boolean).join(" · ")}
        </div>
        <h3 className="sk-car-title">{c.car.name}</h3>
        <div className="sk-car-specs">
          {c.car.passengers != null && <span><SeatIcon /> {c.car.passengers} seats</span>}
          {c.car.bags && (c.car.bags.large > 0 || c.car.bags.small > 0) && (
            <span>
              <BagIcon />{" "}
              {[
                c.car.bags.large > 0 && `${c.car.bags.large} large`,
                c.car.bags.small > 0 && `${c.car.bags.small} small`,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              bags
            </span>
          )}
          {c.car.transmission && <span>{c.car.transmission}</span>}
          {c.car.fuel && <span>{c.car.fuel}</span>}
          {c.mileage && <span>{c.mileage}</span>}
        </div>
        <div className="sk-car-where">
          <PinIcon /> {c.supplier.name} · {c.pickup.name}
          {c.pickup.access ? ` · ${c.pickup.access}` : ""}
        </div>
      </div>
      <div className="sk-car-price">
        <div className="sk-car-total">{money(c.totalAmount, c.currency)}</div>
        <div className="sk-car-sub">
          {money(c.perDay, c.currency)}/day · {c.days} day{c.days === 1 ? "" : "s"}
        </div>
        <div className="sk-car-paylater">Pay at pickup</div>
        {onSelect && (
          <button type="button" className="sk-car-btn" onClick={() => onSelect(c)}>
            Select
          </button>
        )}
        {extra && <div className="sk-car-extra">{extra}</div>}
      </div>
    </article>
  );
}

// groupId: Sync Together trip (the booking is linked to it).
// renderSuggest(car): the "Suggest to group" button, on group trips only.
export default function CarResults({ search, groupId = null, renderSuggest = null }) {
  const [state, setState] = useState({ status: "loading", cars: [], place: null, error: "" });
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!search) return;
    const ctrl = new AbortController();
    setState({ status: "loading", cars: [], place: null, error: "" });
    setSelected(null);
    setFilter("all");
    const qs = new URLSearchParams({
      location: search.location,
      pickupDate: search.pickupDate,
      pickupTime: search.pickupTime,
      dropoffDate: search.dropoffDate,
      dropoffTime: search.dropoffTime,
      driverAge: search.driverAge,
    });
    fetch(`${API}/api/cars/search?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok || !b.ok) throw new Error(b.message || "Couldn't load cars.");
        setState({ status: "done", cars: b.cars || [], place: b.place, error: "" });
        // Opened from an Atlas card: go straight to that car's checkout.
        // From the group shortlist: rate ids expire, so fall back to the
        // same company + model.
        if (search.preselectRateId || search.preselectMatch) {
          const list = b.cars || [];
          const m = search.preselectMatch;
          const same = (a, z) => String(a || "").toLowerCase() === String(z || "").toLowerCase();
          const pick =
            (search.preselectRateId && list.find((c) => c.id === search.preselectRateId)) ||
            (m && list.find((c) => same(c.supplier.name, m.supplier) && same(c.car.name, m.name))) ||
            null;
          if (pick) setSelected(pick);
          else if (m) setState((st) => ({ ...st, notice: "That exact car isn't available anymore — here are the other cars for the same dates." }));
        }
      })
      .catch((e) => e.name !== "AbortError" && setState({ status: "error", cars: [], place: null, error: e.message }));
    return () => ctrl.abort();
  }, [search, retry]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    return f?.match ? state.cars.filter(f.match) : state.cars;
  }, [state.cars, filter]);

  if (!search) return null;

  if (selected) {
    return (
      <CarCheckout
        rate={selected}
        search={search}
        groupId={groupId}
        onBack={() => setSelected(null)}
        onUnavailable={() => {
          setState((s) => ({ ...s, cars: s.cars.filter((c) => c.id !== selected.id) }));
          setSelected(null);
        }}
      />
    );
  }

  return (
    <section className="sk-cars">
      <div className="sk-cars-note" role="note">
        <strong>No payment now.</strong> You pay the rental company at pickup. Prices include taxes and fees the rental company quoted.
      </div>

      {state.notice && <div className="sk-cars-note" role="status">{state.notice}</div>}

      {state.status === "done" && state.cars.length > 0 && (
        <div className="sk-cars-filters" role="tablist">
          {FILTERS.filter((f) => !f.match || state.cars.some(f.match)).map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`sk-cars-filter${filter === f.id ? " is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {state.status === "loading" && (
        <div className="sk-cars-list">
          {[0, 1, 2].map((i) => <div key={i} className="sk-car-card sk-car-skeleton" />)}
        </div>
      )}

      {state.status === "error" && (
        <p className="sk-cars-empty">
          {state.error}{" "}
          <button type="button" className="sk-cars-link" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </p>
      )}

      {state.status === "done" && state.cars.length === 0 && (
        <p className="sk-cars-empty">No cars found for these dates. Try different times or a nearby airport.</p>
      )}

      {shown.length > 0 && (
        <div className="sk-cars-list">
          {shown.map((c) => (
            <CarCard key={c.id} c={c} onSelect={setSelected} extra={renderSuggest ? renderSuggest(c) : null} />
          ))}
        </div>
      )}
    </section>
  );
}
