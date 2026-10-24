import mongoose from "mongoose";

const { Schema } = mongoose;

// Where To Next — cheapest well-rated stay per destination and trip type.
// Hotel prices don't depend on where the traveler flies from, so there's
// one row per destination (not per origin). The deal scan overwrites it.
const HotelSnapshotSchema = new Schema(
  {
    destination: { type: String, required: true, uppercase: true, trim: true },
    tripType: { type: String, enum: ["weekend", "getaway"], required: true },
    checkin: { type: String, required: true }, // YYYY-MM-DD
    checkout: { type: String, required: true }, // YYYY-MM-DD
    hotelId: { type: String, required: true },
    hotelName: { type: String, required: true },
    stars: { type: Number, default: null },
    rating: { type: Number, default: null }, // guest rating out of 10
    price: { type: Number, required: true, min: 0 }, // whole stay, 1 room
    payAtHotel: { type: Number, default: 0 }, // fees not included in price
    currency: { type: String, default: "USD" },
    env: { type: String, default: "sandbox" },
    foundAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

HotelSnapshotSchema.index({ destination: 1, tripType: 1 }, { unique: true });

const HotelSnapshot =
  mongoose.models.HotelSnapshot ||
  mongoose.model("HotelSnapshot", HotelSnapshotSchema);
export default HotelSnapshot;
