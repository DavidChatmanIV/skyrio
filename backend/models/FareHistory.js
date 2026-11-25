import mongoose from "mongoose";

const { Schema } = mongoose;

// "Usual price on Skyrio": the lowest Where To Next fare found each day for
// one origin → destination → trip type (round trip, 1 adult, economy).
// One row per day; kept 120 days, then removed automatically.
const FareHistorySchema = new Schema(
  {
    origin: { type: String, required: true, uppercase: true, trim: true },
    destination: { type: String, required: true, uppercase: true, trim: true },
    tripType: { type: String, enum: ["weekend", "getaway"], required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (UTC) the scan ran
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    departDate: { type: String, default: null },
    returnDate: { type: String, default: null },
    // Sandbox (test) and production fares never mix.
    env: { type: String, default: "sandbox" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

FareHistorySchema.index({ env: 1, origin: 1, destination: 1, tripType: 1, day: 1 }, { unique: true });
FareHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.FareHistory || mongoose.model("FareHistory", FareHistorySchema);
