import mongoose from "mongoose";

const { Schema } = mongoose;

// One row per origin → destination → trip type. The deal scan job
// overwrites it with the cheapest fare it finds each run. The landing
// page only ever READS these rows, so it never waits on a live search.
const DealSnapshotSchema = new Schema(
  {
    origin: { type: String, required: true, uppercase: true, trim: true },
    destination: { type: String, required: true, uppercase: true, trim: true },
    tripType: { type: String, enum: ["weekend", "getaway"], required: true },
    departDate: { type: String, required: true }, // YYYY-MM-DD
    returnDate: { type: String, required: true }, // YYYY-MM-DD
    price: { type: Number, required: true, min: 0 }, // round trip, 1 adult
    currency: { type: String, default: "USD" },
    airline: { type: String, default: null },
    stops: { type: Number, default: null },
    // "sandbox" prices are test fares, never shown as real deals.
    env: { type: String, default: "sandbox" },
    foundAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

DealSnapshotSchema.index(
  { origin: 1, destination: 1, tripType: 1 },
  { unique: true }
);

const DealSnapshot =
  mongoose.models.DealSnapshot ||
  mongoose.model("DealSnapshot", DealSnapshotSchema);
export default DealSnapshot;
