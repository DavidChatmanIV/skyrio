// backend/controllers/eventsController.js
import { searchEvents, getEventById } from "../providers/ticketmasterProvider.js";
import {
  CATEGORY_MAP,
  isValidDate,
  todayISO,
  addDays,
  toTmDateTime,
  clampNumber,
  normalizeEvent,
} from "../utils/eventsUtils.js";

const HIDDEN_STATUSES = new Set(["cancelled", "canceled", "offsale"]);

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error("[events]", err.message);
  res.status(status).json({ error: status >= 500 && !err.status ? "Couldn't load events" : err.message });
}

/**
 * GET /api/events
 * Query: city, state, lat, lng, radius, startDate, endDate (YYYY-MM-DD),
 *        category (all|sports|music|shows|family), keyword, page
 */
export async function listEvents(req, res) {
  try {
    const { city, state, lat, lng, radius, startDate, endDate, category, keyword, page } = req.query;

    const hasCoords = lat !== undefined && lng !== undefined && lat !== "" && lng !== "";
    const latNum = hasCoords ? Number(lat) : null;
    const lngNum = hasCoords ? Number(lng) : null;

    if (hasCoords && (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180)) {
      return res.status(400).json({ error: "Invalid lat/lng" });
    }
    if (!hasCoords && !city?.trim()) {
      return res.status(400).json({ error: "Provide a city or lat/lng" });
    }

    const start = startDate || todayISO();
    const end = endDate || addDays(start, 30);
    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({ error: "Dates must be YYYY-MM-DD" });
    }
    if (end < start) return res.status(400).json({ error: "endDate must be on or after startDate" });

    if (category && category !== "all" && !CATEGORY_MAP[category]) {
      return res.status(400).json({ error: "Unknown category" });
    }

    const size = 20;
    // Ticketmaster only allows paging through the first 1,000 results
    const pageNum = clampNumber(page, 0, Math.floor(1000 / size) - 1, 0);

    const data = await searchEvents({
      city: hasCoords ? undefined : city.trim(),
      stateCode: state,
      lat: latNum,
      lng: lngNum,
      radius: clampNumber(radius, 1, 100, 25),
      startDateTime: toTmDateTime(start),
      endDateTime: toTmDateTime(end, true),
      classificationName: category && category !== "all" ? CATEGORY_MAP[category] : undefined,
      keyword: keyword?.trim()?.slice(0, 100),
      page: pageNum,
      size,
    });

    const events = (data._embedded?.events || [])
      .map(normalizeEvent)
      .filter((e) => !HIDDEN_STATUSES.has(e.status));

    res.json({
      events,
      page: {
        number: data.page?.number ?? pageNum,
        totalPages: Math.min(data.page?.totalPages ?? 0, Math.floor(1000 / size)),
        totalElements: data.page?.totalElements ?? events.length,
      },
      attribution: "Event data from Ticketmaster",
    });
  } catch (err) {
    sendError(res, err);
  }
}

/** GET /api/events/:id — one event with suggested trip dates + venue coords */
export async function getEvent(req, res) {
  try {
    const { id } = req.params;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res.status(400).json({ error: "Invalid event id" });
    const raw = await getEventById(id);
    res.json({ event: normalizeEvent(raw), attribution: "Event data from Ticketmaster" });
  } catch (err) {
    sendError(res, err);
  }
}
