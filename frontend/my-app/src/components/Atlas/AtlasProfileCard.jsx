// src/components/atlas/AtlasProfileCard.jsx
// Shown in the Atlas chat when a start_profile_setup tool result comes back.
// Usage:
//   <AtlasProfileCard
//     focus={result.focus} travelerId={result.travelerId} reason={result.reason}
//     onDone={(summary) => sendAtlasMessage(`[Profile setup finished: ${summary}]`)}
//   />
// Details go straight to /api/travel-profile and Stripe. Only a short summary
// ("profile saved, 1 traveler added, card saved") goes back to Atlas.
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { atlasApi } from "./atlasApi";
import "@/styles/atlas-booking-card.css";

// If the key is missing in this build (e.g. not set on Vercel), skip Stripe
// instead of crashing; the card step shows a message.
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const STEPS = ["self", "travelers", "card"];
const STEP_LABEL = { self: "You", travelers: "Travelers", card: "Card" };

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
  </svg>
);

async function api(path, method = "GET", body) {
  const { ok, data } = await atlasApi(`/api/travel-profile${path}`, {
    method,
    body: method === "GET" ? undefined : body || {},
  });
  if (!ok) throw data;
  return data;
}

function Field({ label, error, children, hint }) {
  return (
    <label className="apc-field">
      <span className="apc-label">{label}</span>
      {children}
      {hint && !error && <span className="apc-hint">{hint}</span>}
      {error && <span className="apc-error">{error}</span>}
    </label>
  );
}

function PersonFields({ value, onChange, errors, withPhone, withRelation }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      {withRelation && (
        <Field label="Who is this?" error={errors.relation}>
          <select value={value.relation || ""} onChange={set("relation")}>
            <option value="">Choose…</option>
            <option value="partner">Partner or spouse</option>
            <option value="child">Child</option>
            <option value="parent">Parent</option>
            <option value="friend">Friend</option>
            <option value="other">Other</option>
          </select>
        </Field>
      )}
      <div className="apc-row">
        <Field label="First name" error={errors.legalFirstName}>
          <input value={value.legalFirstName || ""} onChange={set("legalFirstName")} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.legalLastName}>
          <input value={value.legalLastName || ""} onChange={set("legalLastName")} autoComplete="family-name" />
        </Field>
      </div>
      <div className="apc-row">
        <Field label="Date of birth" error={errors.dateOfBirth}>
          <input type="date" value={value.dateOfBirth || ""} onChange={set("dateOfBirth")} autoComplete="bday" />
        </Field>
        <Field label="Gender on ID" error={errors.gender}>
          <select value={value.gender || ""} onChange={set("gender")}>
            <option value="">Choose…</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Unspecified (X)</option>
          </select>
        </Field>
      </div>
      {withPhone && (
        <Field label="Phone" error={errors.phone}>
          <input type="tel" value={value.phone || ""} onChange={set("phone")} autoComplete="tel" />
        </Field>
      )}
      <Field
        label="Known Traveler Number (optional)"
        error={errors.knownTravelerNumber}
        hint={value.ktnLast4 ? `Saved: •••• ${value.ktnLast4}. Enter a new one to replace it.` : "TSA PreCheck or Global Entry"}
      >
        <input value={value.knownTravelerNumber || ""} onChange={set("knownTravelerNumber")} autoComplete="off" />
      </Field>
    </>
  );
}

function CardForm({ onSaved }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    try {
      const profile = await api("/card/confirm", "POST", { setupIntentId: setupIntent.id });
      onSaved(profile);
    } catch (e) {
      setErr(e.error || "Card wasn't saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PaymentElement />
      {err && <p className="apc-error">{err}</p>}
      <button className="abc-btn abc-primary apc-full" onClick={save} disabled={busy || !stripe}>
        {busy ? "Saving…" : "Save card"}
      </button>
    </>
  );
}

export default function AtlasProfileCard({ focus = "full", travelerId = null, reason, onDone }) {
  const startStep = focus === "full" ? "self" : focus;
  const [step, setStep] = useState(startStep);
  const [profile, setProfile] = useState(null);
  const [self, setSelf] = useState({});
  const [companion, setCompanion] = useState(null); // form open when non-null
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [done, setDone] = useState(false);
  const [changes, setChanges] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    // Never spin forever: give up after 12s with a clear message + retry.
    const timer = setTimeout(() => {
      if (!cancelled) setLoadError("Your profile is taking too long to load.");
    }, 12000);
    api("/")
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setSelf({ ...p.self, homeAirport: p.preferences?.homeAirport, seatPreference: p.preferences?.seatPreference });
        if (travelerId) {
          const c = (p.companions || []).find((x) => x.id === travelerId);
          if (c) setCompanion(c);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e?.error || e?.message || "Couldn't load your profile.");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [travelerId, attempt]);

  useEffect(() => {
    if (step === "card" && !clientSecret && stripePromise) {
      api("/card/setup-intent", "POST")
        .then((r) => setClientSecret(r.clientSecret))
        .catch(() => setErrors({ form: "Couldn't start card setup. Try again in a moment." }));
    }
  }, [step, clientSecret]);

  const stepsShown = useMemo(() => (focus === "full" ? STEPS : [startStep]), [focus, startStep]);
  const next = () => {
    const i = stepsShown.indexOf(step);
    if (i < stepsShown.length - 1) setStep(stepsShown[i + 1]);
    else finish();
  };

  function finish(extra = []) {
    const all = [...changes, ...extra];
    setDone(true);
    onDone?.(all.length ? all.join(", ") : "no changes");
  }

  async function saveSelf() {
    setBusy(true);
    setErrors({});
    try {
      const p = await api("/self", "PUT", self);
      setProfile(p);
      setSelf({ ...p.self, homeAirport: p.preferences.homeAirport, seatPreference: p.preferences.seatPreference });
      setChanges((c) => [...c, "your profile saved"]);
      next();
    } catch (e) {
      setErrors(e.errors || { form: "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function saveCompanion() {
    setBusy(true);
    setErrors({});
    try {
      const p = companion.id
        ? await api(`/companions/${companion.id}`, "PUT", companion)
        : await api("/companions", "POST", companion);
      setProfile(p);
      setChanges((c) => [...c, `${companion.legalFirstName} ${companion.id ? "updated" : "added"}`]);
      setCompanion(null);
      if (focus === "travelers" && travelerId) finish([`${companion.legalFirstName} updated`]);
    } catch (e) {
      setErrors(e.errors || { form: "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!profile && loadError) {
    return (
      <div className="abc-card" role="alert">
        <p className="abc-msg">{loadError}</p>
        <div className="abc-actions">
          <button className="abc-btn abc-primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="abc-card abc-loading">Loading your profile…</div>;

  if (done) {
    return (
      <div className="abc-card">
        <div className="abc-done">
          <CheckIcon /> Travel profile saved
        </div>
        <p className="abc-hold">You can change it anytime in Settings.</p>
      </div>
    );
  }

  return (
    <div className="abc-card apc-card">
      <div className="abc-title">Your travel profile</div>
      {reason && <p className="abc-hold">{reason}</p>}
      <p className="apc-secure">
        <LockIcon /> Goes straight to Skyrio, not into the chat. Use names exactly as they appear on your ID.
      </p>

      {stepsShown.length > 1 && (
        <div className="apc-steps">
          {stepsShown.map((s) => (
            <span key={s} className={s === step ? "on" : ""}>
              {STEP_LABEL[s]}
            </span>
          ))}
        </div>
      )}

      {step === "self" && (
        <>
          <PersonFields value={self} onChange={setSelf} errors={errors} withPhone />
          <div className="apc-row">
            <Field label="Home airport" error={errors.homeAirport} hint="e.g. EWR">
              <input
                value={self.homeAirport || ""}
                maxLength={3}
                onChange={(e) => setSelf({ ...self, homeAirport: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Seat">
              <select value={self.seatPreference || "no_preference"} onChange={(e) => setSelf({ ...self, seatPreference: e.target.value })}>
                <option value="no_preference">No preference</option>
                <option value="window">Window</option>
                <option value="aisle">Aisle</option>
              </select>
            </Field>
          </div>
          {errors.form && <p className="apc-error">{errors.form}</p>}
          <button className="abc-btn abc-primary apc-full" onClick={saveSelf} disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </button>
        </>
      )}

      {step === "travelers" && (
        <>
          {!companion && (
            <>
              <p className="abc-hold">People you book for, like a partner or kids. Optional.</p>
              <ul className="apc-list">
                {profile.companions.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.legalFirstName} {c.legalLastName} <em>{c.relation}</em>
                    </span>
                    <button className="apc-link" onClick={() => setCompanion(c)}>
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
              <button className="abc-btn abc-ghost apc-full" onClick={() => setCompanion({})}>
                Add a traveler
              </button>
              <button className="abc-btn abc-primary apc-full" onClick={next}>
                {stepsShown.indexOf(step) < stepsShown.length - 1 ? "Continue" : "Done"}
              </button>
            </>
          )}
          {companion && (
            <>
              <PersonFields value={companion} onChange={setCompanion} errors={errors} withRelation />
              {errors.form && <p className="apc-error">{errors.form}</p>}
              <div className="abc-actions">
                <button className="abc-btn abc-primary" onClick={saveCompanion} disabled={busy}>
                  {busy ? "Saving…" : "Save traveler"}
                </button>
                <button className="abc-btn abc-ghost" onClick={() => { setCompanion(null); setErrors({}); }}>
                  Back
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step === "card" && (
        <>
          {profile.card && (
            <p className="abc-hold">
              Saved now: {profile.card.brand} •••• {profile.card.last4}. Add a new one to replace it.
            </p>
          )}
          <p className="abc-hold">Saved securely with Stripe. You're only charged when you tap Confirm & Pay on a booking.</p>
          {!stripePromise ? (
            <p className="abc-msg">Saving a card isn't available right now. You can still pay on the checkout page.</p>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
              <CardForm
                onSaved={(p) => {
                  setProfile(p);
                  finish(["card saved"]);
                }}
              />
            </Elements>
          ) : (
            <p className="abc-hold">Loading secure card form…</p>
          )}
          {profile.card && (
            <button className="abc-btn abc-ghost apc-full" onClick={() => finish()}>
              Keep my saved card
            </button>
          )}
        </>
      )}
    </div>
  );
}
