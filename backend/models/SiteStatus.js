// One live travel alert for the whole site ("disruption mode").
// A single document (key: "current") holds what's showing right now; the
// last 30 changes are kept on it so there's a record of what was posted.
import mongoose from "mongoose";

export const ALERT_KINDS = [
  "ground_stop", // FAA/air traffic control stops flights
  "airport", // one or more airports closed or limited
  "weather", // storms, hurricanes, snow
  "airline_outage", // an airline's systems are down
  "strike", // strikes or labor action
  "security", // security event
  "health", // health or entry restrictions
  "natural_disaster", // earthquake, wildfire, volcanic ash
  "skyrio_issue", // a problem on Skyrio's side (payments, search)
  "maintenance", // planned Skyrio maintenance
  "other",
];
export const ALERT_SEVERITIES = ["info", "warning", "critical"];

const snapshot = {
  active: Boolean,
  kind: String,
  severity: String,
  title: String,
  message: String,
  areas: String,
  affects: { flights: Boolean, hotels: Boolean, cars: Boolean },
  pause: { flights: Boolean, hotels: Boolean, cars: Boolean },
  by: String,
  at: Date,
};

const siteStatusSchema = new mongoose.Schema(
  {
    key: { type: String, default: "current", unique: true },
    active: { type: Boolean, default: false },
    kind: { type: String, enum: ALERT_KINDS, default: "other" },
    severity: { type: String, enum: ALERT_SEVERITIES, default: "warning" },
    title: { type: String, default: "", maxlength: 80 },
    message: { type: String, default: "", maxlength: 300 },
    // Free text, e.g. "All US airports" or "EWR, JFK, LGA".
    areas: { type: String, default: "", maxlength: 120 },
    affects: {
      flights: { type: Boolean, default: true },
      hotels: { type: Boolean, default: false },
      cars: { type: Boolean, default: false },
    },
    // New bookings of these kinds are refused while the alert is on.
    pause: {
      flights: { type: Boolean, default: false },
      hotels: { type: Boolean, default: false },
      cars: { type: Boolean, default: false },
    },
    // Changes every time the alert is posted or edited. Traveler emails
    // remember it so the same alert isn't emailed to someone twice.
    version: { type: String, default: "" },
    startedAt: Date,
    updatedBy: { type: String, default: "" },
    notifiedBookingIds: { type: [String], default: [] },
    history: { type: [snapshot], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.SiteStatus ||
  mongoose.model("SiteStatus", siteStatusSchema);
