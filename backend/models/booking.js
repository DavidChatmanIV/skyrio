import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  name: { type: String },
  email: { type: String },
  tripDetails: { type: String, required: true },
  type: {
    type: String,
    enum: ["Flight", "Hotel", "Package", "Cruise", "Car"],
    required: true,
  },
  destination: { type: String },
  destinationCity: { type: String },
  destinationCountry: { type: String },
  date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending",
  },
});

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
export default Booking;