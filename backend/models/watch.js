import mongoose from "mongoose";

const WatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, default: "flights" },
    // Added: origin airport code — required to re-run a LiteAPI search
    // later. `destination` already stores the destination airport code
    // for flight watches (BookingPage sends flight.destination, an IATA
    // code, not a city name).
    origin: { type: String, default: "" },
    destination: { type: String, default: "" },
    dates: { type: [String], default: null }, // [departDate, returnDate]
    guests: { type: String, default: "" },
    adults: { type: Number, default: 1 },
    cabin: { type: String, default: "economy" },
    lastSeenPrice: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

WatchSchema.index(
  {
    userId: 1,
    type: 1,
    origin: 1,
    destination: 1,
    guests: 1,
    dates: 1,
    active: 1,
  },
  { unique: false }
);

export default mongoose.model("Watch", WatchSchema);
