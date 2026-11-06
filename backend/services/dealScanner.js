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
// Hotels hit LiteAPI's rate limit (429) at 3 at a time, so they run slower.
const HOTEL_CONCURRENCY = Number(process.env.DEAL_SCAN_HOTEL_CONCURRENCY || 2);
// Pause each worker takes between searches, so DealScan never bursts
// LiteAPI and eats the request limit real customers' searches need.
const GAP_MS = Number(process.env.DEAL_SCAN_GAP_MS || 500);
// How many times to retry a search that came back 429 (rate limited).
const MAX_RETRIES = Number(process.env.DEAL_SCAN_MAX_RETRIES || 2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Rate-limit handling ───────────────────────────────────────
// Flights errors carry the status on err.response.status (axios);
// hotels errors carry it on err.status.
function statusOf(err) {
  return err?.response?.status ?? err?.status;
}

function isRateLimited(err) {
  return statusOf(err) === 429;
}

// Honor LiteAPI's Retry-After header when it sends one; otherwise back off
// 3s, then 6s, plus a little jitter so workers don't retry in lockstep.
function retryDelayMs(err, attempt) {
  const header =
    err?.response?.headers?.["retry-after"] ?? err?.headers?.["retry-after"];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 3000 * 2 ** attempt + Math.floor(Math.random() * 500);
}

// Runs fn(); if LiteAPI says 429, waits and tries again (up to MAX_RETRIES).
// Timeouts and other errors are NOT retried — a slow search already cost
// up to 60s, and retrying it would just stall the run.
async function withRetry(fn, label) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err) || attempt >= MAX_RETRIES) throw err;
      const wait = retryDelayMs(err, attempt);
      console.warn(
        `[DealScan] ${label} rate limited — retry ${
          attempt + 1
        }/${MAX_RETRIES} in ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
    }
  }
}

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
// Each worker pauses GAP_MS between searches to keep the pace steady.
async function runPool(tasks, limit) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (i < tasks.length) {
        const task = tasks[i++];
        await task();
        if (GAP_MS > 0 && i < tasks.length) await sleep(GAP_MS);
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
        const best = await withRetry(
          () =>
            searchCheapestStay({
              cityName: dest.hotelCity,
              countryCode: dest.country,
              checkin,
              checkout,
            }),
          `hotels ${dest.code} (${tripType})`
        );
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
    HOTEL_CONCURRENCY
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
    // Order matters: the list is cut at MAX_SEARCHES. Most-used home bases
    // come first, and each destination gets BOTH trip types back to back,
    // so even a small limit fills Weekend and 4-night getaway evenly.
    const dates = {
      weekend: tripDates("weekend"),
      getaway: tripDates("getaway"),
    };
    for (const origin of origins) {
      for (const dest of DESTINATIONS) {
        if (dest.code === origin) continue;
        for (const tripType of ["weekend", "getaway"]) {
          jobs.push({
            origin,
            destination: dest.code,
            tripType,
            departDate: dates[tripType].departDate,
            returnDate: dates[tripType].returnDate,
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
          const best = await withRetry(
            () => searchCheapestFare(job),
            `${job.origin}→${job.destination} (${job.tripType})`
          );
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
