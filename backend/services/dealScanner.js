// Where To Next — deal scan job.
//
// Runs on a schedule (see startDealScanJob at the bottom). For every home
// base airport in use, it searches LiteAPI for a weekend trip and a 4-night
// getaway to each destination and saves the cheapest fare it finds.
// The landing page reads those saved rows; it never runs a live search.

import User from "../models/user.js";
import DealSnapshot from "../models/DealSnapshot.js";
import HotelSnapshot from "../models/HotelSnapshot.js";
import { searchCheapestFare } from "../routes/api/flights/Liteapiflights.deals.js";
import { searchCheapestStay } from "../routes/api/hotels/hotels.deals.js";
import {
  DESTINATIONS,
  DEFAULT_ORIGINS,
  airportGroupFor,
} from "../config/dealRoutes.js";

const ENV = process.env.LITEAPI_ENV || "sandbox";
const CONCURRENCY = Number(process.env.DEAL_SCAN_CONCURRENCY || 3);
const MAX_SEARCHES = Number(process.env.DEAL_SCAN_MAX_SEARCHES || 150);
const MAX_ORIGINS = Number(process.env.DEAL_SCAN_MAX_ORIGINS || 6);
// Hotel prices for "Flight + hotel". One search per destination per trip
// type (~40 per run). Set DEAL_SCAN_HOTELS=false to skip them.
const SCAN_HOTELS = process.env.DEAL_SCAN_HOTELS !== "false";

// ── Dates ─────────────────────────────────────────────────────
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Weekend: Friday → Sunday, about two weeks out.
// Getaway: 4 nights, leaving a Thursday about five weeks out.
export function tripDates(tripType, from = new Date()) {
  const base = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const targetDow = tripType === "weekend" ? 5 : 4; // Fri / Thu
  const lead = tripType === "weekend" ? 14 : 35;
  let depart = addDays(base, lead);
  while (depart.getUTCDay() !== targetDow) depart = addDays(depart, 1);
  const nights = tripType === "weekend" ? 2 : 4;
  return { departDate: iso(depart), returnDate: iso(addDays(depart, nights)) };
}

// ── Which origins to scan ─────────────────────────────────────
// Real home bases first (most popular first), plus the nearby airports in
// each one's group, plus the defaults. Capped so LiteAPI usage stays sane.
async function originsToScan() {
  const rows = await User.aggregate([
    { $match: { "homeAirport.code": { $ne: null }, isActive: true } },
    { $group: { _id: "$homeAirport.code", users: { $sum: 1 } } },
    { $sort: { users: -1 } },
    { $limit: MAX_ORIGINS },
  ]);
  const set = new Set();
  for (const r of rows) airportGroupFor(r._id).forEach((c) => set.add(c));
  DEFAULT_ORIGINS.forEach((c) => set.add(c));
  return [...set];
}

// ── Tiny concurrency pool (no extra dependency) ───────────────
async function runPool(tasks, limit) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (i < tasks.length) {
        const task = tasks[i++];
        await task();
      }
    }
  );
  await Promise.all(workers);
}

// Same check-in/check-out dates as the flights, so "flight + hotel" is one
// real trip. Hotels don't depend on the origin: one row per destination.
export async function scanHotels() {
  let saved = 0;
  let empty = 0;
  let failed = 0;
  const jobs = [];
  for (const tripType of ["weekend", "getaway"]) {
    const { departDate, returnDate } = tripDates(tripType);
    for (const dest of DESTINATIONS) {
      if (!dest.hotelCity || !dest.country) continue;
      jobs.push({ dest, tripType, checkin: departDate, checkout: returnDate });
    }
  }

  await runPool(
    jobs.map(({ dest, tripType, checkin, checkout }) => async () => {
      try {
        const best = await searchCheapestStay({
          cityName: dest.hotelCity,
          countryCode: dest.country,
          checkin,
          checkout,
        });
        if (!best) {
          empty++;
          return;
        }
        await HotelSnapshot.findOneAndUpdate(
          { destination: dest.code, tripType },
          {
            destination: dest.code,
            tripType,
            checkin,
            checkout,
            ...best,
            env: ENV,
            foundAt: new Date(),
          },
          { upsert: true, new: true }
        );
        saved++;
      } catch (err) {
        failed++;
        console.warn(
          `[DealScan] hotels ${dest.code} (${tripType}) failed:`,
          err?.status || err?.message
        );
      }
    }),
    CONCURRENCY
  );
  console.log(
    `[DealScan] hotels · saved ${saved} · no stays ${empty} · failed ${failed}`
  );
}

let running = false;

export async function runDealScan() {
  if (running) {
    console.log("[DealScan] previous run still going — skipping");
    return;
  }
  running = true;
  const started = Date.now();
  let saved = 0;
  let empty = 0;
  let failed = 0;

  try {
    const origins = await originsToScan();
    const jobs = [];
    for (const tripType of ["weekend", "getaway"]) {
      const { departDate, returnDate } = tripDates(tripType);
      for (const origin of origins) {
        for (const dest of DESTINATIONS) {
          if (dest.code === origin) continue;
          jobs.push({
            origin,
            destination: dest.code,
            tripType,
            departDate,
            returnDate,
          });
        }
      }
    }
    const batch = jobs.slice(0, MAX_SEARCHES);
    console.log(
      `[DealScan] ${batch.length}/${
        jobs.length
      } searches · origins ${origins.join(",")} · env ${ENV}`
    );

    await runPool(
      batch.map((job) => async () => {
        try {
          const best = await searchCheapestFare(job);
          if (!best) {
            empty++;
            return;
          }
          await DealSnapshot.findOneAndUpdate(
            {
              origin: job.origin,
              destination: job.destination,
              tripType: job.tripType,
            },
            { ...job, ...best, env: ENV, foundAt: new Date() },
            { upsert: true, new: true }
          );
          saved++;
        } catch (err) {
          failed++;
          console.warn(
            `[DealScan] ${job.origin}→${job.destination} (${job.tripType}) failed:`,
            err?.response?.data?.error?.code ||
              err?.response?.status ||
              err.message
          );
        }
      }),
      CONCURRENCY
    );

    if (SCAN_HOTELS) await scanHotels();
  } finally {
    running = false;
    console.log(
      `[DealScan] done in ${Math.round(
        (Date.now() - started) / 1000
      )}s · saved ${saved} · no flights ${empty} · failed ${failed}`
    );
  }
}

// Default: every 8 hours, first run 2 minutes after boot so it doesn't
// compete with server start-up.
export function startDealScanJob() {
  if (process.env.DEAL_SCAN_ENABLED !== "true") {
    console.log("[DealScan] disabled (set DEAL_SCAN_ENABLED=true to turn on)");
    return;
  }
  const hours = Number(process.env.DEAL_SCAN_EVERY_HOURS || 8);
  setTimeout(runDealScan, 2 * 60 * 1000);
  setInterval(runDealScan, hours * 60 * 60 * 1000);
}
