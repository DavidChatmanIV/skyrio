// Runs the Where To Next HOTEL scan once and exits, so you can test it
// without waiting for the full scan. From the backend folder:
//
//   node scripts/scanHotelsOnce.js
//
// It prints one line per city and a summary at the end.

import "dotenv/config";
import mongoose from "mongoose";
import { scanHotels } from "../services/dealScanner.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || undefined;

if (!uri) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}

await mongoose.connect(uri, { dbName });
console.log("Connected — scanning hotels (this can take a minute)…");
try {
  await scanHotels();
} finally {
  await mongoose.disconnect();
}
