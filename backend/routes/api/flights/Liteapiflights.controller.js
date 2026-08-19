import { liteApiFlights } from "./Liteapiflights.provider.js";
import {
  buildLiteApiSearchPayload,
  buildVerifyPayload,
  buildPrebookPayload,
  buildAttachServicesPayload,
  buildCompleteBookingPayload,
  normalizeFlightSearchResponse,
  toFrontendFlightShape,
} from "./Liteapiflights.utils.js";

export async function searchFlights(req, res) {
  try {
    const source = req.method === "GET" ? req.query : req.body;

    const {
      from,
      to,
      departDate,
      returnDate,
      adults,
      children,
      cabin,
      origin,
      destination,
      departureDate,
      cabinClass,
    } = source;

    const resolvedOrigin = origin || from;
    const resolvedDestination = destination || to;
    const resolvedDepartureDate = departureDate || departDate;
    const resolvedCabin = cabinClass || cabin;

    if (!resolvedOrigin || !resolvedDestination || !resolvedDepartureDate) {
      return res.status(400).json({
        error: "from, to, and departDate are required",
      });
    }

    const payload = buildLiteApiSearchPayload({
      origin: resolvedOrigin,
      destination: resolvedDestination,
      departureDate: resolvedDepartureDate,
      returnDate,
      adults: adults ? Number(adults) : undefined,
      children: children ? Number(children) : undefined,
      cabinClass: resolvedCabin,
    });

    const { data } = await liteApiFlights.post("/flights/rates", payload);

    const results = normalizeFlightSearchResponse(data);
    const flights = results.map(toFrontendFlightShape);

    // ok + flights matches the shape BookingPage.jsx already expects
    // from the earlier Duffel integration — no frontend changes needed.
    return res.status(200).json({ ok: true, flights });
  } catch (err) {
    console.error(
      "LiteAPI flights search failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.message || err.message,
    });
  }
}

/**
 * Step 1 of 4 — confirm the offer is still valid and get latest pricing
 * before prebooking. LiteAPI's own docs say to always call this before
 * /prebooks to avoid price discrepancies.
 */
export async function verifyOffer(req, res) {
  try {
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: "offerId is required" });
    }

    const payload = buildVerifyPayload({ offerId });
    const { data } = await liteApiFlights.post("/flights/verify", payload);

    return res.status(200).json(data);
  } catch (err) {
    console.error(
      "LiteAPI verify offer failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      error: "Verify offer failed",
      detail: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 2 of 4 — reserve the offer with the provider and create a payment
 * intent (when usePaymentSdk is true). Returns a prebookId used in the
 * next two steps.
 */
export async function createPrebook(req, res) {
  try {
    const {
      offerId,
      contact,
      passengers,
      usePaymentSdk,
      includeCreditBalance,
      payment,
    } = req.body;

    if (!offerId || !contact || !passengers) {
      return res.status(400).json({
        error: "offerId, contact, and passengers are required",
      });
    }

    const payload = buildPrebookPayload({
      offerId,
      contact,
      passengers,
      usePaymentSdk,
      includeCreditBalance,
      payment,
    });

    const { data } = await liteApiFlights.post("/flights/prebooks", payload);

    return res.status(200).json(data);
  } catch (err) {
    console.error(
      "LiteAPI prebook failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      error: "Prebook failed",
      detail: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 3 of 4 (OPTIONAL) — attach ancillary services (seat selection,
 * extra baggage) to an existing prebook before finalizing.
 */
export async function attachPrebookServices(req, res) {
  try {
    const { prebookId } = req.params;
    const { selectedServices, voucherCode } = req.body;

    if (!prebookId) {
      return res.status(400).json({ error: "prebookId is required" });
    }
    if (!selectedServices) {
      return res.status(400).json({ error: "selectedServices is required" });
    }

    const payload = buildAttachServicesPayload({
      selectedServices,
      voucherCode,
    });

    const { data } = await liteApiFlights.post(
      `/flights/prebooks/${prebookId}/services`,
      payload
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error(
      "LiteAPI attach services failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      error: "Attach services failed",
      detail: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 4 of 4 — finalize the booking using the prebookId from step 2.
 * NOTE: field name is `prebookID` (capital ID), confirmed via a live
 * 45013 validation error. Payment confirmation fields beyond prebookID
 * are still unconfirmed — test with a real prebookId to find out what
 * else this endpoint expects.
 */
export async function completeBooking(req, res) {
  try {
    const { prebookID, ...rest } = req.body;

    if (!prebookID) {
      return res.status(400).json({ error: "prebookID is required" });
    }

    const payload = buildCompleteBookingPayload({ prebookID, ...rest });

    const { data } = await liteApiFlights.post("/flights/bookings", payload);

    return res.status(200).json(data);
  } catch (err) {
    console.error(
      "LiteAPI complete booking failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      error: "Complete booking failed",
      detail: err?.response?.data?.error?.message || err.message,
    });
  }
}
