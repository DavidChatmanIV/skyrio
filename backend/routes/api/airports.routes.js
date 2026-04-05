import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const airportsPath = path.resolve(__dirname, "../../airports.json");

let airports = [];

try {
  const raw = fs.readFileSync(airportsPath, "utf-8");
  const parsed = JSON.parse(raw);

  // supports either array format or object keyed by code
  airports = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
} catch (err) {
  console.error("[airports.routes] Failed to load airports.json:", err.message);
  airports = [];
}

/**
 * GET /api/airports?q=ewr
 * Search by code, name, city, or country
 */
router.get("/", (req, res) => {
  try {
    const query = String(req.query.q || "")
      .trim()
      .toLowerCase();

    const filteredAirports = airports.filter((airport) => {
      const code = String(
        airport.code || airport.iata || airport.iata_code || ""
      ).toLowerCase();

      const name = String(airport.name || "").toLowerCase();
      const city = String(
        airport.city || airport.municipality || ""
      ).toLowerCase();
      const country = String(
        airport.country || airport.country_name || ""
      ).toLowerCase();

      return (
        !query ||
        code.includes(query) ||
        name.includes(query) ||
        city.includes(query) ||
        country.includes(query)
      );
    });

    return res.json(filteredAirports.slice(0, 25));
  } catch (err) {
    console.error("[airports.routes] GET / error:", err);
    return res.status(500).json({ error: "Failed to load airports" });
  }
});

/**
 * GET /api/airports/health
 */
router.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    route: "airports",
    count: airports.length,
  });
});

export default router;