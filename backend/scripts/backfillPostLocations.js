// One-time script: adds map points to existing SkyHub posts that have a
// destination but no location, and builds the geo index.
// Run from the backend folder:  node scripts/backfillPostLocations.js

import "dotenv/config";
import mongoose from "mongoose";
import SkyHubPost from "../models/SkyHubPost.js";
import { geocodePlace } from "../utils/geocode.js";

await mongoose.connect(process.env.MONGO_URI);
await SkyHubPost.syncIndexes();

const posts = await SkyHubPost.find({
  destination: { $ne: "" },
  "location.coordinates": { $exists: false },
});

let done = 0;
const missed = [];

for (const p of posts) {
  const point = await geocodePlace(p.destination);
  if (point) {
    p.location = point;
    await p.save({ validateBeforeSave: false });
    done++;
  } else {
    missed.push(p.destination);
  }
}

console.log(`Added locations to ${done} of ${posts.length} posts`);
if (missed.length) console.log("Couldn't find:", [...new Set(missed)]);

await mongoose.disconnect();
