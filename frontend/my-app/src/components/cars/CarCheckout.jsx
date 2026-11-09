// Car rental checkout: confirm price (quote) → driver details → book.
// Postpaid only: nothing is charged by Skyrio; the traveler pays the rental
// company at pickup. Shows the supplier's cancellation and rental terms
// (cancellation up front, everything else collapsed).
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { apiHeaders } from "@/utils/checkoutToken";
import { CarCard, money } from "./CarResults";

const API = import.meta.env.VITE_API_URL || "";
const when = (date, time) =>
  date ? dayjs(`${date}T${time || "10:00"}`).format("ddd, MMM D · h:mm A") : "—";

// "7866217900" → "(786) 621-7900"; anything else is left as given.
function prettyPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : p;
}
// Supplier terms often arrive in ALL CAPS — make them readable.
function readable(text) {
  const t = String(text || "");
  const letters = t.replace(/[^A-Za-z]/g, "");
  const caps = letters.replace(/[^A-Z]/g, "").length;
  if (!letters.length || caps / letters.length < 0.6) return t;
  return t
    .toLowerCase()
    .replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(dw|ldw|cdw|us|usa|id)\b/g, (m) => m.toUpperCase());
}

function Terms({ supplier, items }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  const cancel = items.filter((t) => /cancel/i.test(`${t.title} ${t.text}`.slice(0, 120)));
  const rest = items.filter((t) => !cancel.includes(t));
  return (
    <div className="sk-car-terms">
      {cancel.length > 0 && (
        <>
          <div className="sk-car-terms-title">Cancellation</div>
          {cancel.map((t, i) => (
            <p key={i}>{t.title && !/cancel/i.test(t.title) ? <strong>{t.title}: </strong> : null}{readable(t.text)}</p>
          ))}
        </>
      )}
      {rest.length > 0 && (
        <>
          <button type="button" className="sk-car-terms-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span>{supplier} rental terms ({rest.length})</span>
            <span className="sk-car-terms-cta">{open ? "Hide" : "Show"}</span>
          </button>
          {open && (
            <div className="sk-car-terms-body">
              {rest.map((t, i) => (
                <p key={i}>
                  {t.title && <strong>{t.title}: </strong>}
                  {readable(t.text)}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Location({ quote, pickupAt, dropoffAt }) {
  const same = !quote.dropoff;
  const block = (label, loc, times) => (
    <div className="sk-car-loc">
      <div className="sk-car-loc-label">{label}</div>
      {times.map(([k, v]) => (
        <div key={k} className="sk-car-loc-when">
          {times.length > 1 && <span className="sk-car-loc-k">{k}</span>}
          {v}
        </div>
      ))}
      <div className="sk-car-loc-name">{loc.name}</div>
      {loc.address && <div className="sk-car-loc-line">{loc.address}</div>}
      {loc.access && <div className="sk-car-loc-line">{loc.access}</div>}
      {loc.phone && (
        <div className="sk-car-loc-line">
          Counter: <a href={`tel:${String(loc.phone).replace(/[^\d+]/g, "")}`}>{prettyPhone(loc.phone)}</a>
        </div>
      )}
      {loc.instructions?.map((i, k) => (
        <div key={k} className="sk-car-loc-line"><strong>{i.title}:</strong> {i.text}</div>
      ))}
    </div>
  );
  return (
    <div className={`sk-car-locs${same ? " is-single" : ""}`}>
      {same
        ? block("Pick-up & drop-off", quote.pickup, [["Pick-up", pickupAt], ["Drop-off", dropoffAt]])
        : [block("Pick-up", quote.pickup, [["", pickupAt]]), block("Drop-off", quote.dropoff, [["", dropoffAt]])]}
    </div>
  );
}

export default function CarCheckout({ rate, search, groupId = null, onBack, onUnavailable }) {
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [driver, setDriver] = useState({ firstName: "", lastName: "", email: "", phone: "", dob: "" });
  const [flightNumber, setFlightNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Confirm price + availability with the rental company.
  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/cars/quote`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        rateId: rate.id,
        pickupDate: search.pickupDate,
        pickupTime: search.pickupTime,
        dropoffDate: search.dropoffDate,
        dropoffTime: search.dropoffTime,
      }),
    })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok && b.ok) setQuote(b.quote);
        else setQuoteError(b.message || "Couldn't confirm this car. Please pick another.");
      })
      .catch(() => alive && setQuoteError("Couldn't reach the rental company. Please try again."));
    return () => {
      alive = false;
    };
  }, [rate.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setDriver((d) => ({ ...d, [k]: e?.target ? e.target.value : e || "" }));
  const priceMoved = quote && Math.abs(Number(quote.totalAmount) - Number(rate.totalAmount)) >= 0.01;
  const pickupAt = when(quote?.pickupDate || search.pickupDate, quote?.pickupTime || search.pickupTime);
  const dropoffAt = when(quote?.dropoffDate || search.dropoffDate, quote?.dropoffTime || search.dropoffTime);

  async function book() {
    setError("");
    if (!driver.firstName.trim() || !driver.lastName.trim()) return setError("Enter the driver's name exactly as on their license.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(driver.email)) return setError("Enter a valid email for your confirmation.");
    if (!driver.phone || !isValidPhoneNumber(driver.phone)) return setError("Enter a valid phone number.");
    if (!driver.dob) return setError("Enter the driver's date of birth.");
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/cars/book`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          quoteId: quote.id,
          driver,
          flightNumber: flightNumber || undefined,
          // Sync Together: shows on the trip tracker and counts toward your budget.
          ...(groupId && { groupId }),
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok && b.ok) {
        setDone(b);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (b.unavailable) {
        setError(b.message);
        setTimeout(() => onUnavailable?.(), 2500);
        return;
      }
      setError(b.message || "We couldn't book this car. Please try again.");
    } catch {
      setError("We lost connection. Check My Trips before trying again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const q = quote || rate;
    return (
      <section className="sk-cars">
        <div className="sk-car-done" role="status">
          <div className="sk-car-done-title">Your car is booked</div>
          {done.reference && (
            <div className="sk-car-done-ref">
              Confirmation <strong>{done.reference}</strong>
            </div>
          )}
          <p className="sk-car-done-pay">
            Pay <strong>{q.supplier.name} {money(q.totalAmount, q.currency)}</strong> at pickup. Bring the driver's
            license and a credit card in the driver's name.
          </p>
          <Location quote={q} pickupAt={pickupAt} dropoffAt={dropoffAt} />
          <Terms supplier={q.supplier.name} items={q.conditions} />
          <a href="/saved-trips" className="sk-car-btn sk-car-btn--big" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            View My Trips
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="sk-cars">
      <button type="button" className="sk-cars-link sk-car-backlink" onClick={onBack}>
        ← Back to cars
      </button>

      <CarCard c={quote || rate} />

      {!quote && !quoteError && <p className="sk-cars-empty">Confirming price with {rate.supplier.name}…</p>}
      {quoteError && (
        <div className="sk-car-error" role="alert">
          {quoteError}{" "}
          <button type="button" className="sk-cars-link" onClick={onUnavailable}>Pick another car</button>
        </div>
      )}

      {quote && (
        <>
          {priceMoved && (
            <div className="sk-cars-note" role="status">
              {quote.supplier.name} updated the price from {money(rate.totalAmount, rate.currency)} to{" "}
              <strong>{money(quote.totalAmount, quote.currency)}</strong>.
            </div>
          )}

          <div className="sk-car-pay-box">
            <div className="sk-car-pay-big">No payment now</div>
            <div>
              Pay <strong>{quote.supplier.name} {money(quote.totalAmount, quote.currency)}</strong> at pickup. Skyrio
              doesn't charge your card.
            </div>
            {quote.charges?.length > 0 && (
              <ul className="sk-car-charges">
                {quote.charges.map((c, i) => (
                  <li key={i}>{c.description}: {money(c.amount, c.currency || quote.currency)}</li>
                ))}
              </ul>
            )}
          </div>

          <Location quote={quote} pickupAt={pickupAt} dropoffAt={dropoffAt} />

          <div className="sk-car-form">
            <div className="sk-car-form-title">Driver</div>
            <div className="sk-car-grid">
              <label>First name<input value={driver.firstName} onChange={set("firstName")} autoComplete="given-name" /></label>
              <label>Last name<input value={driver.lastName} onChange={set("lastName")} autoComplete="family-name" /></label>
              <label>Email<input type="email" inputMode="email" value={driver.email} onChange={set("email")} autoComplete="email" /></label>
              <label>Phone<PhoneInput defaultCountry="US" value={driver.phone} onChange={set("phone")} autoComplete="tel" /></label>
              <label>Date of birth<input type="date" value={driver.dob} onChange={set("dob")} max={dayjs().subtract(18, "year").format("YYYY-MM-DD")} /></label>
              <label>Arriving flight <span className="sk-car-optional">(optional)</span><input placeholder="e.g. B6123" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} autoCapitalize="characters" /></label>
            </div>
            <p className="sk-car-hint">Name must match the driver's license. A flight number lets the counter hold your car if you land late.</p>
          </div>

          <Terms supplier={quote.supplier.name} items={quote.conditions} />
          {quote.privacyPolicies?.length > 0 && (
            <p className="sk-car-privacy">
              {quote.privacyPolicies.map((t) => readable(t.text)).join(" ")}
            </p>
          )}

          <button type="button" role="checkbox" aria-checked={agreed} className={`sk-car-agree${agreed ? " is-on" : ""}`} onClick={() => setAgreed((v) => !v)}>
            <span className="sk-car-check">{agreed ? "✓" : ""}</span>
            <span>
              I agree to {quote.supplier.name}'s rental terms and Skyrio's{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>terms</a> and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>privacy policy</a>.
            </span>
          </button>

          {error && <div className="sk-car-error" role="alert">{error}</div>}

          <div className="sk-car-book-bar">
            <div className="sk-car-book-total">
              <span>Due at pickup</span>
              <strong>{money(quote.totalAmount, quote.currency)}</strong>
            </div>
            <button type="button" className="sk-car-btn sk-car-btn--big" disabled={!agreed || busy} onClick={book}>
              {busy ? "Booking…" : "Book car"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
