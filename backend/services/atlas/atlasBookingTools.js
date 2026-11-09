// backend/services/atlas/atlasBookingTools.js
// Tools Atlas (Claude API, tool use) can call to search and PROPOSE bookings.
// There is deliberately NO "book" or "pay" tool. Paying only happens from the
// user's tap on the confirm card -> POST /api/atlas/proposals/:id/confirm.
//
// Wire-up (already done in routes/atlas/atlas.routes.js):
//   signed in: tools = [...ATLAS_SUPPORT_TOOLS, ...ATLAS_BOOKING_TOOLS]
//   guest:     tools = ATLAS_GUEST_BOOKING_TOOLS
//   isBookingTool(name) ? runBookingTool(name, args, { userId, guestKey }) : runAtlasTool(...)
//
// Two ways to pay:
//   - propose_booking: signed in + saved card -> "Confirm & Pay" card in chat
//   - open_checkout:   anyone (guests too) -> "Review & pay" card that opens the
//                      normal checkout page, where they enter travelers + pay
// runBookingTool returns { result, action } just like your services/atlasTools.js,
// so the chat panel gets a "booking" or "profile_setup" card the same way it gets "cancel".
//
// The provider imports below point at the functions your existing checkout
// already uses. Rename them to match your files.
import AtlasBookingProposal from "../../models/AtlasBookingProposal.js";
import AtlasCheckoutHandoff from "../../models/AtlasCheckoutHandoff.js";
import { limiter } from "../../middleware/draftRateLimit.js";
import User from "../../models/user.js";
import { firstNameOf } from "./userName.js";
import SyncTrip from "../../models/SyncGroup.js";
import { isGroupMember } from "../sharedRooms.js";
import {
  searchFlights, // your LiteAPI flight search (returns offers with offerId)
  verifyFlightOffer, // POST /v3.0/flights/verify  { offerID }
  createFlightPrebook, // POST /v3.0/flights/prebooks { offerId, passengers, contact, ... }
} from "../../providers/liteapi/flights.js";
import {
  searchHotelRates, // POST /hotels/rates
  createHotelPrebook, // POST /rates/prebook { offerId }
} from "../../providers/liteapi/hotels.js";
import {
  buildPassengersFromProfile,
  buildHotelGuestsFromProfile,
  IncompleteProfileError,
} from "./travelerProfile.js";
import crypto from "crypto";
import {
  rankForUser,
  learnFromChoice,
  rememberStated,
  forgetStated,
} from "./atlasLearning.js";
import { LEARNING_CATEGORIES } from "../../models/AtlasLearnedPreference.js";
// Cars (Duffel, pay at pickup) and events (Ticketmaster) — same code the
// Book page's Cars and Events tabs use.
import { searchCars, CarSearchError } from "../../routes/api/cars/cars.service.js";
import { searchEvents } from "../../providers/ticketmasterProvider.js";
import {
  CATEGORY_MAP as EVENT_CATEGORIES,
  normalizeEvent,
  toTmDateTime,
  addDays,
} from "../../utils/eventsUtils.js";

// ───────────────────────── Tool definitions (sent to Claude) ─────────────────────────

export const ATLAS_BOOKING_TOOLS = [
  {
    name: "get_traveler_profile",
    description:
      "Get the signed-in user's saved travel preferences and the list of saved travelers they can book for (by id and first name only). Call this before searching so you can use their home airport and preferences.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "start_profile_setup",
    description:
      "Show the user a secure in-chat form to build or finish their travel profile: legal name, date of birth, gender, phone, Known Traveler Number, travelers they book for, and a saved card. Use this whenever get_traveler_profile shows missing info or no saved card, or the user asks to set up their profile. Never ask for these details in chat yourself; the form sends them straight to Skyrio.",
    parameters: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["full", "self", "travelers", "card"],
          description:
            "Which step to open on. Use 'full' for a brand-new profile.",
        },
        travelerId: {
          type: "string",
          description:
            "A saved traveler whose profile is incomplete, if fixing one person",
        },
        reason: {
          type: "string",
          description:
            "One short line shown on the card, e.g. 'To book your Miami flight'",
        },
      },
      required: ["focus"],
    },
  },
  {
    name: "save_travel_preferences",
    description:
      "Save non-sensitive travel preferences the user tells you in chat, like home airport, seat preference, cabin, or hotel preferences. Only save what the user clearly stated.",
    parameters: {
      type: "object",
      properties: {
        homeAirport: { type: "string", description: "IATA code, e.g. EWR" },
        seatPreference: {
          type: "string",
          enum: ["window", "aisle", "no_preference"],
        },
        cabin: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
        },
        hotelPrefs: {
          type: "object",
          properties: {
            bedType: {
              type: "string",
              enum: ["king", "queen", "two_beds", "no_preference"],
            },
            maxNightly: { type: "number" },
            mustHave: {
              type: "array",
              items: { type: "string" },
              description: "e.g. pool, free breakfast, gym",
            },
          },
        },
      },
    },
  },
  {
    name: "remember_preference",
    description:
      "Remember something the traveler clearly told you about how they like to travel, so you can adapt next time, e.g. 'hates red-eye flights', 'likes boutique hotels', 'wants shorter replies'. Only what they actually said. Never health, religion, politics, money details, or anything sensitive.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: LEARNING_CATEGORIES },
        text: {
          type: "string",
          description: "Short plain sentence, e.g. 'Avoids red-eye flights'",
        },
      },
      required: ["category", "text"],
    },
  },
  {
    name: "forget_preference",
    description:
      "Forget something you learned about the traveler when they say it's wrong or no longer true.",
    parameters: {
      type: "object",
      properties: {
        match: {
          type: "string",
          description: "A few words from the thing to forget",
        },
      },
      required: ["match"],
    },
  },
  {
    name: "search_flights",
    description:
      "Search flights. Returns up to 5 options with an optionId for each. Prices are live and expire in about 13 minutes.",
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string", description: "IATA code, e.g. EWR" },
        destination: { type: "string", description: "IATA code, e.g. MIA" },
        departDate: { type: "string", description: "YYYY-MM-DD" },
        returnDate: {
          type: "string",
          description: "YYYY-MM-DD, omit for one-way",
        },
        adults: { type: "integer", minimum: 1 },
        children: { type: "integer", minimum: 0 },
        cabin: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
        },
        maxPrice: { type: "number", description: "Optional budget cap in USD" },
      },
      required: ["origin", "destination", "departDate", "adults"],
    },
  },
  {
    name: "search_hotels",
    description:
      "Search hotel rates. Returns up to 5 options with an optionId for each.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", description: "City or place name" },
        checkin: { type: "string", description: "YYYY-MM-DD" },
        checkout: { type: "string", description: "YYYY-MM-DD" },
        adults: { type: "integer", minimum: 1 },
        children: { type: "integer", minimum: 0 },
        rooms: { type: "integer", minimum: 1 },
        maxNightly: {
          type: "number",
          description: "Optional nightly budget cap in USD",
        },
      },
      required: ["destination", "checkin", "checkout", "adults"],
    },
  },
  {
    name: "search_cars",
    description:
      "Search rental cars at an airport. Every car is paid to the rental company at pickup — Skyrio charges nothing. Returns up to 5 options with an optionId each. To book, call open_checkout with the optionId the user picks.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Pick-up airport IATA code, e.g. MIA" },
        pickupDate: { type: "string", description: "YYYY-MM-DD" },
        dropoffDate: { type: "string", description: "YYYY-MM-DD" },
        pickupTime: { type: "string", description: "HH:MM 24h, default 10:00" },
        dropoffTime: { type: "string", description: "HH:MM 24h, default 10:00" },
        driverAge: { type: "integer", minimum: 18, description: "Only if the driver is under 30" },
        carType: {
          type: "string",
          enum: ["any", "small", "midsize", "suv", "van", "premium"],
          description: "Only if the user asked for a kind of car",
        },
        maxTotal: { type: "number", description: "Optional cap on the rental total in USD" },
      },
      required: ["location", "pickupDate", "dropoffDate"],
    },
  },
  {
    name: "search_events",
    description:
      "Find concerts, sports games, shows and family events in a city for given dates (Ticketmaster). Returns up to 6 events with an optionId each. Tickets are sold by Ticketmaster, not Skyrio.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Miami" },
        stateCode: { type: "string", description: "US state code if known, e.g. FL" },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        endDate: { type: "string", description: "YYYY-MM-DD (default: start + 7 days)" },
        category: { type: "string", enum: ["all", "sports", "music", "shows", "family"] },
        keyword: { type: "string", description: "Team, artist or show name, if the user named one" },
      },
      required: ["city", "startDate"],
    },
  },
  {
    name: "show_event",
    description:
      "Show the user a card for one event with a 'Buy on Ticketmaster' button and a 'Plan a trip around it' button. Call after they show interest in a specific event from search_events.",
    parameters: {
      type: "object",
      properties: { optionId: { type: "string", description: "optionId from search_events" } },
      required: ["optionId"],
    },
  },
  {
    name: "get_sync_trip",
    description:
      "Get a Sync Together group trip the user belongs to: destination, dates, and the flights/hotel other members already booked (with whether each is still available), plus the user's own share status and private budget.",
    parameters: {
      type: "object",
      properties: { syncTripId: { type: "string" } },
      required: ["syncTripId"],
    },
  },
  {
    name: "propose_booking",
    description:
      "Lock in a chosen flight or hotel option and show the user a confirm card with the real total. This does NOT charge or book anything. The user must tap Confirm & Pay. Only call this after the user clearly picks an option. For Sync Together, pass syncTripId; this books only the user's own share.",
    parameters: {
      type: "object",
      properties: {
        optionId: {
          type: "string",
          description:
            "optionId from search_flights, search_hotels, or get_sync_trip",
        },
        travelerIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Saved traveler ids from get_traveler_profile. Use 'self' for the user.",
        },
        syncTripId: { type: "string" },
        sharedRoomId: {
          type: "string",
          description: "Sync Together shared room to join, if any",
        },
      },
      required: ["optionId", "travelerIds"],
    },
  },
  {
    name: "open_checkout",
    description:
      "Show a 'Review & pay' card that opens Skyrio's checkout page on the option the user picked. They enter traveler details and pay there. Use this for guests, for signed-in users with no saved card, or when the user would rather pay on the checkout page. Only call it after the user clearly picks an option. It does NOT book or charge anything. For a car (from search_cars) the card opens the car's checkout, where they add driver details; cars are paid at pickup.",
    parameters: {
      type: "object",
      properties: {
        optionId: {
          type: "string",
          description: "optionId from search_flights, search_hotels or search_cars",
        },
      },
      required: ["optionId"],
    },
  },
];

// Saved-card "Confirm & Pay" (propose_booking) is switched OFF for now: its
// booking controller was never finished (no LiteAPI book step). Everyone —
// signed in or not — books through open_checkout and the normal checkout
// page. To turn it back on later, remove this filter.
const DISABLED_TOOLS = new Set(["propose_booking"]);
for (let i = ATLAS_BOOKING_TOOLS.length - 1; i >= 0; i--) {
  if (DISABLED_TOOLS.has(ATLAS_BOOKING_TOOLS[i].name))
    ATLAS_BOOKING_TOOLS.splice(i, 1);
}

// Guests (not signed in) can search and get a checkout link — nothing that
// reads or saves an account.
const GUEST_TOOL_NAMES = new Set([
  "search_flights",
  "search_hotels",
  "search_cars",
  "search_events",
  "show_event",
  "open_checkout",
]);
export const ATLAS_GUEST_BOOKING_TOOLS = ATLAS_BOOKING_TOOLS.filter((t) =>
  GUEST_TOOL_NAMES.has(t.name)
);

// Where the checkout pages live on the frontend. Change if your routes differ.
const FRONTEND_URL = (
  process.env.FRONTEND_URL || "https://myskyrio.com"
).replace(/\/$/, "");
// One page handles both: it loads the handoff and shows BookingCheckout or HotelCheckout.
const checkoutUrl = (handoffId) =>
  `${FRONTEND_URL}/checkout/atlas/${handoffId}`;

// Each search is a paid LiteAPI call. Guests get fewer per hour.
const searchLimit = limiter({
  windowMs: 60 * 60 * 1000,
  guestMax: 15,
  userMax: 60,
});

// ───────────────────────── Option cache ─────────────────────────
// The model only ever sees short optionIds. Real offerIds/prices stay server-side,
// so Atlas can't invent a price or swap in an offer the user never saw.
// Options belong to whoever searched: a signed-in user id, or "g:<guest key>".
const optionCache = new Map(); // optionId -> { owner, kind, raw, display, search, expiresAt }
const OPTION_TTL_MS = 13 * 60 * 1000;

function cacheOption(owner, kind, raw, display, search = {}) {
  const optionId = `${kind[0]}_${crypto.randomBytes(6).toString("base64url")}`;
  optionCache.set(optionId, {
    owner: String(owner),
    kind,
    raw,
    display,
    search,
    expiresAt: Date.now() + OPTION_TTL_MS,
  });
  return optionId;
}

function getOption(owner, optionId) {
  const opt = optionCache.get(optionId);
  if (!opt || opt.owner !== String(owner)) return null;
  if (Date.now() > opt.expiresAt) {
    optionCache.delete(optionId);
    return null;
  }
  return opt;
}

// ───────────────────────── Tool handlers ─────────────────────────

async function runBookingToolRaw(name, input, { userId, owner, ip }) {
  if (
    ["search_flights", "search_hotels", "search_cars", "search_events"].includes(name) &&
    !searchLimit.tryConsume({ userId, guestKeyHash: userId ? null : owner, ip })
  ) {
    return {
      error:
        "Too many searches in a short time. Ask the user to try again in a few minutes.",
    };
  }
  switch (name) {
    case "get_traveler_profile":
      return getTravelerProfile(userId);
    case "start_profile_setup":
      // The frontend renders <AtlasProfileCard {...card} /> for this result
      return {
        card: "profile_setup",
        focus: input.focus,
        travelerId: input.travelerId || null,
        reason: input.reason || null,
        instruction:
          "Tell the user a secure form opened below. Their details go straight to Skyrio, not into this chat. Wait for them to finish before continuing.",
      };
    case "save_travel_preferences":
      return saveTravelPreferences(userId, input);
    case "remember_preference":
      return rememberStated(userId, input);
    case "forget_preference":
      return forgetStated(userId, input.match);
    case "search_flights":
      return runFlightSearch(owner, userId, input);
    case "search_hotels":
      return runHotelSearch(owner, userId, input);
    case "search_cars":
      return runCarSearch(owner, input);
    case "search_events":
      return runEventSearch(owner, input);
    case "show_event":
      return showEvent(owner, input);
    case "open_checkout":
      return openCheckout(owner, userId, input);
    case "get_sync_trip":
      return getSyncTripForAtlas(userId, input.syncTripId);
    case "propose_booking":
      try {
        return await proposeBooking(userId, input);
      } catch (err) {
        if (err instanceof IncompleteProfileError) {
          return {
            error: err.message,
            fix: "Call start_profile_setup (focus 'self' for the user, or 'travelers' with travelerId) so they can finish it here, then propose again.",
          };
        }
        if (err.code === 42005)
          return { error: "That price expired. Search again for a fresh one." };
        throw err;
      }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

async function getTravelerProfile(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return { error: "User not found" };
  const p = user.travelProfile || {};
  const selfMissing = ["legalLastName", "dateOfBirth", "phone"].filter(
    (k) => !p[k]
  );
  const hasSavedCard = Boolean(
    user.stripeCustomerId && user.defaultPaymentMethodId
  );
  return {
    profileStatus:
      selfMissing.length === 0 && hasSavedCard
        ? "ready"
        : !p.legalLastName && !p.dateOfBirth
        ? "new"
        : "incomplete",
    missing: [
      ...selfMissing.map(
        (k) =>
          ({
            legalLastName: "legal name",
            dateOfBirth: "date of birth",
            phone: "phone",
          }[k])
      ),
      ...(hasSavedCard ? [] : ["saved card"]),
    ],
    homeAirport: user.homeAirport?.code || null, // your existing Digital Passport field
    seatPreference: p.seatPreference || null, // "window" | "aisle"
    cabin: p.cabin || "economy",
    hotelPrefs: p.hotelPrefs || null,
    hasSavedCard,
    // First names + ids only. Passport/DOB/KTN never go to the model.
    travelers: [
      {
        id: "self",
        firstName: p.legalFirstName || firstNameOf(user),
        profileComplete: Boolean(p.dateOfBirth && p.legalLastName),
      },
      ...(p.companions || []).map((c) => ({
        id: String(c._id),
        firstName: c.firstName,
        relation: c.relation, // "child", "partner", ...
        profileComplete: Boolean(c.dateOfBirth && c.legalLastName),
      })),
    ],
  };
}

const IATA = /^[A-Z]{3}$/;

async function saveTravelPreferences(userId, input) {
  const set = {};
  if (input.homeAirport) {
    const code = input.homeAirport.trim().toUpperCase();
    if (!IATA.test(code))
      return {
        error: "Home airport must be a 3-letter airport code like EWR.",
      };
    set["homeAirport.code"] = code; // same field the Digital Passport uses
  }
  if (input.seatPreference)
    set["travelProfile.seatPreference"] = input.seatPreference;
  if (input.cabin) set["travelProfile.cabin"] = input.cabin;
  if (input.hotelPrefs) set["travelProfile.hotelPrefs"] = input.hotelPrefs;
  if (!Object.keys(set).length) return { error: "Nothing to save." };

  await User.updateOne({ _id: userId }, { $set: set });
  return {
    saved: Object.keys(set).map((k) => k.replace("travelProfile.", "")),
  };
}

// Remembers what was shown in each search so a pick can teach Atlas something
const searchGroups = new Map(); // searchId -> [display, ...]

// Reads the same top-level fields the Book page / BookingCheckout use
// (owner, departingAt, arrivingAt, totalAmount, stops), with segments only
// as a fallback — so a missing or differently named segment field can't
// crash every Atlas search.
function flightDisplay(o) {
  const f = o.frontend || {};
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const first = segs[0] || {};
  const last = segs[segs.length - 1] || {};
  const stops =
    typeof f.stops === "number"
      ? f.stops
      : typeof f.slices?.[0]?.stops === "number"
      ? f.slices[0].stops
      : Math.max(0, segs.length - 1);
  return {
    airline: o.airlineName || f.owner || f.airline || "Airline",
    airlineCode: o.airlineCode || f.ownerCode || null,
    flightNumbers:
      segs
        .map((s) => s.flightNumber)
        .filter(Boolean)
        .join(", ") || null,
    depart: f.departingAt || f.departureTime || first.departTime || null,
    arrive: f.arrivingAt || f.arrivalTime || last.arriveTime || null,
    returnDepart: f.returningAt || null,
    stops,
    duration: o.durationText || null,
    price: Number(o.price?.total ?? f.totalAmount),
    currency: o.price?.currency || f.totalCurrency || "USD",
    includedBags: o.baggageSummary || "Not listed by airline",
  };
}

async function runFlightSearch(owner, userId, input) {
  const badDate = checkDates([
    ["Departure date", input.departDate],
    ["Return date", input.returnDate, true],
  ]);
  if (badDate) return badDate;
  if (input.returnDate && input.returnDate < input.departDate) {
    return {
      error:
        "Return date is before the departure date. Check the dates with the traveler.",
    };
  }
  let offers;
  try {
    offers = await searchFlights(input);
  } catch (err) {
    console.error(
      "[Atlas search_flights] search failed:",
      err.message,
      err.response?.data || ""
    );
    return {
      error: "Flight search failed. Try different dates or a nearby airport.",
    };
  }
  const candidates = offers
    .map((o) => ({ _raw: o, ...flightDisplay(o) }))
    .filter(
      (c) =>
        Number.isFinite(c.price) &&
        (!input.maxPrice || c.price <= input.maxPrice)
    )
    .slice(0, 15);
  if (!candidates.length) {
    return {
      options: [],
      note: "No flights found for that search. Suggest nearby dates or airports.",
    };
  }

  // Put options this traveler tends to pick first (signed-in only; guests keep provider order)
  const ranked = (
    userId ? await rankForUser(userId, "flight", candidates) : candidates
  ).slice(0, 5);
  const search = {
    origin: input.origin,
    destination: input.destination,
    departDate: input.departDate,
    returnDate: input.returnDate || null,
    adults: input.adults,
    children: input.children || 0,
    cabin: input.cabin || "economy",
  };
  const searchId = crypto.randomUUID();
  searchGroups.set(
    searchId,
    ranked.map(({ _raw, ...d }) => d)
  );
  setTimeout(() => searchGroups.delete(searchId), OPTION_TTL_MS).unref?.();

  return {
    options: ranked.map(({ _raw, ...display }) => ({
      optionId: cacheOption(
        owner,
        "flight",
        _raw,
        { ...display, searchId },
        search
      ),
      ...display,
    })),
    note: "Prices are live and expire in about 13 minutes. Options with whyForYou match this traveler's usual picks.",
  };
}

async function runHotelSearch(owner, userId, input) {
  const badDate = checkDates([
    ["Check-in", input.checkin],
    ["Check-out", input.checkout],
  ]);
  if (badDate) return badDate;
  if (input.checkout <= input.checkin) {
    return {
      error:
        "Check-out must be after check-in. Check the dates with the traveler.",
    };
  }
  const rates = await searchHotelRates(input);
  const candidates = rates
    .filter((r) => !input.maxNightly || r.nightly <= input.maxNightly)
    .slice(0, 15)
    .map((r) => ({
      _raw: r,
      hotel: r.hotelName,
      starRating: r.starRating,
      room: r.roomName,
      board: r.boardName,
      nightly: r.nightly,
      total: r.total,
      currency: r.currency,
      refundable: r.refundableTag === "RFN",
      cancellation: r.cancellationText,
    }));

  const ranked = (
    userId ? await rankForUser(userId, "hotel", candidates) : candidates
  ).slice(0, 5);
  const search = {
    destination: input.destination,
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.adults,
    children: input.children || 0,
    rooms: input.rooms || 1,
  };
  const searchId = crypto.randomUUID();
  searchGroups.set(
    searchId,
    ranked.map(({ _raw, ...d }) => d)
  );
  setTimeout(() => searchGroups.delete(searchId), OPTION_TTL_MS).unref?.();

  return {
    options: ranked.map(({ _raw, ...display }) => ({
      optionId: cacheOption(
        owner,
        "hotel",
        _raw,
        { ...display, searchId },
        search
      ),
      ...display,
    })),
  };
}

// Reads a Sync Together group (models/SyncGroup.js). The group flight is
// the shortlist item the organizer picked (groupFlightKey); the group
// hotel is groupHotel. Only the requesting member's own status/budget
// is returned.
async function getSyncTripForAtlas(userId, syncTripId) {
  const trip = await SyncTrip.findById(syncTripId).lean();
  if (!trip) return { error: "Group trip not found" };
  if (!isGroupMember(trip, userId))
    return { error: "You're not a member of this trip" };

  const isOwner = String(trip.owner?._id ?? trip.owner) === String(userId);
  const me =
    (trip.members || []).find(
      (m) => m.user && String(m.user) === String(userId)
    ) || null;

  // Re-check the group's picked flight so Atlas never offers one that's gone
  const groupFlights = [];
  const picked = (trip.shortlist || []).find(
    (it) => it.kind === "flight" && it.key === trip.groupFlightKey
  );
  const f = picked?.flight;
  if (f?.origin && f?.destination && f?.departAt) {
    const fresh = await searchFlights({
      origin: f.origin,
      destination: f.destination,
      departDate: String(f.departAt).slice(0, 10),
      returnDate: f.returnDepartAt
        ? String(f.returnDepartAt).slice(0, 10)
        : undefined,
      adults: 1,
    }).catch(() => []);
    const match = fresh.find(
      (o) =>
        (!f.airlineCode || o.airlineCode === f.airlineCode) &&
        String(flightDisplay(o).depart || "").slice(0, 16) ===
          String(f.departAt).slice(0, 16)
    );
    groupFlights.push({
      airline: f.airline,
      route: `${f.origin} → ${f.destination}`,
      depart: f.departAt,
      stillAvailable: Boolean(match),
      ...(match && {
        optionId: cacheOption(
          String(userId),
          "flight",
          match,
          {
            ...flightDisplay(match),
            fromGroup: true, // joining friends' flight is a group choice, not a personal habit
          },
          {
            origin: f.origin,
            destination: f.destination,
            departDate: String(f.departAt).slice(0, 10),
            returnDate: f.returnDepartAt
              ? String(f.returnDepartAt).slice(0, 10)
              : null,
            adults: 1,
            children: 0,
          }
        ),
        price: flightDisplay(match).price,
        currency: flightDisplay(match).currency,
      }),
    });
  }

  return {
    name: trip.title,
    destination: trip.destination,
    departureAirport: me?.departureAirport || trip.departureAirport || null,
    dates: { start: trip.dateRangeStart, end: trip.dateRangeEnd },
    myStatus: me?.paymentStatus || "unpaid",
    myBudget: isOwner ? trip.ownerBudget ?? null : me?.budget ?? null, // only the requesting user's own budget
    groupFlights: groupFlights.filter((g) => g.stillAvailable),
    hotel: trip.groupHotel?.hotelId
      ? {
          name: trip.groupHotel.name,
          address: trip.groupHotel.address,
          stars: trip.groupHotel.stars,
        }
      : null,
  };
}

function partyFromTravelers(user, travelerIds) {
  const companions = new Map(
    (user.travelProfile?.companions || []).map((c) => [String(c._id), c])
  );
  let adults = 0;
  let children = 0;
  for (const id of travelerIds) {
    if (id === "self") adults++;
    else if (companions.get(id)?.relation === "child") children++;
    else adults++;
  }
  return { adults, children };
}

async function proposeBooking(
  userId,
  { optionId, travelerIds, syncTripId, sharedRoomId }
) {
  const opt = getOption(userId, optionId);
  if (!opt)
    return { error: "That option expired. Search again to get a fresh price." };
  // Shared-room shares are held and split in services/sharedRooms.js;
  // Atlas can't book them yet, so send the user to the group page.
  if (sharedRoomId) {
    return {
      error:
        "Shared rooms are booked from the group trip page for now, not through Atlas.",
    };
  }

  const user = await User.findById(userId).lean();
  if (!user?.defaultPaymentMethodId) {
    return {
      error: "No saved card yet.",
      fix: "Offer two choices: add a card now (start_profile_setup with focus 'card'), or pay on the checkout page (open_checkout with the same optionId).",
    };
  }

  // Sync Together guardrails: only the user's own share, and only if they're a member
  if (syncTripId) {
    const trip = await SyncTrip.findById(syncTripId).lean();
    if (!trip || !isGroupMember(trip, userId))
      return { error: "You're not a member of this trip" };
    if (travelerIds.some((id) => id !== "self")) {
      return { error: "In a group trip, Atlas can only book your own share." };
    }
  }

  let prebook;
  let summary;

  if (opt.kind === "flight") {
    const passengers = await buildPassengersFromProfile(userId, travelerIds); // throws if a profile is incomplete
    await verifyFlightOffer(opt.raw.offerId);
    prebook = await createFlightPrebook({
      offerId: opt.raw.offerId,
      passengers,
      contact: { email: user.email },
    });
    summary = {
      title: `${opt.raw.segments[0].origin} → ${
        opt.raw.segments.at(-1).destination
      } · ${opt.display.depart}`,
      lines: [
        `${opt.display.airline} ${opt.display.flightNumbers}`,
        `${
          opt.display.stops === 0 ? "Nonstop" : `${opt.display.stops} stop(s)`
        } · ${opt.display.duration}`,
        `Bags: ${opt.display.includedBags}`,
        `${travelerIds.length} traveler(s)`,
      ],
      cancellation: prebook.fareRulesText || "See fare rules",
    };
  } else {
    const guests = await buildHotelGuestsFromProfile(userId, travelerIds);
    prebook = await createHotelPrebook({ offerId: opt.raw.offerId, guests });
    summary = {
      title: `${opt.display.hotel}`,
      lines: [
        opt.display.room,
        opt.display.board,
        sharedRoomId ? "Your share of a shared room" : null,
      ].filter(Boolean),
      cancellation: prebook.cancellationText || opt.display.cancellation,
    };
  }

  // The charged amount comes from the prebook response, not from search or the model
  const total = sharedRoomId ? prebook.perPersonShare : prebook.price.total;

  const proposal = await AtlasBookingProposal.create({
    user: userId,
    kind: opt.kind,
    syncTrip: syncTripId || null,
    sharedRoomId: sharedRoomId || null,
    offerId: opt.raw.offerId,
    prebookId: prebook.prebookId,
    travelerIds,
    summary,
    amount: Math.round(total * 100),
    currency: prebook.price.currency.toLowerCase(),
    learnSummary:
      opt.kind === "flight"
        ? {
            kind: "flight",
            flight: {
              airlineCode: opt.display.airlineCode,
              airlineName: opt.display.airline,
              stops: opt.display.stops,
              departHour: new Date(opt.display.depart).getHours(),
              price: total / Math.max(1, travelerIds.length),
            },
            party: partyFromTravelers(user, travelerIds),
            groupTrip: Boolean(syncTripId),
            followedGroup: Boolean(opt.display.fromGroup),
          }
        : {
            kind: "hotel",
            hotel: {
              nightly: opt.display.nightly,
              starRating: opt.display.starRating,
            },
            party: partyFromTravelers(user, travelerIds),
            groupTrip: Boolean(syncTripId),
            // A shared room or the group's hotel is picked with friends, not alone
            followedGroup: Boolean(sharedRoomId),
          },
  });

  optionCache.delete(optionId);

  // Learn from what they picked vs. what else they saw (non-blocking)
  const shown = searchGroups.get(opt.display.searchId);
  if (shown)
    learnFromChoice(userId, opt.kind, shown, opt.display).catch(() => {});

  // The chat frontend renders this as <AtlasBookingCard proposalId=... />
  return {
    proposalId: String(proposal._id),
    total,
    currency: prebook.price.currency,
    expiresInMinutes: 12,
    instruction:
      "Tell the user to review the card and tap Confirm & Pay. Do not say it's booked.",
  };
}

// Dates the model sends are checked here so a wrong year never reaches LiteAPI.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function todayISO() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
function checkDates(pairs) {
  const today = todayISO();
  for (const [label, value, optional] of pairs) {
    if (!value && optional) continue;
    if (!ISO_DAY.test(String(value || ""))) {
      return {
        error: `${label} must be a date like ${today}. Today is ${today}.`,
      };
    }
    if (value < today) {
      return {
        error: `${label} ${value} is in the past. Today is ${today}. Use the next upcoming date and confirm it with the traveler.`,
      };
    }
  }
  return null;
}

// Saves the picked option and returns a "Review & pay" link to the checkout page.
// Nothing is booked or charged here — the checkout page does that as usual.
async function openCheckout(owner, userId, { optionId }) {
  const opt = getOption(owner, optionId);
  if (!opt)
    return { error: "That option expired. Search again to get a fresh price." };
  if (opt.display?.fromGroup) {
    return {
      error:
        "Group trip shares are booked from the Sync Together trip page so friends' payments stay linked. Point the user there.",
    };
  }
  if (opt.kind === "car") return openCarCheckout(opt);
  if (opt.kind === "event") {
    return {
      error:
        "Events are bought on Ticketmaster. Call show_event with this optionId instead.",
    };
  }
  if (!opt.raw?.frontend) {
    return {
      error:
        "This option can't open checkout. Search again to get a fresh one.",
    };
  }

  const remainingMs = opt.expiresAt - Date.now();
  if (remainingMs < 2 * 60 * 1000) {
    return {
      error:
        "That price is about to expire. Search again so they have time to pay.",
    };
  }

  // Check the fare with the airline BEFORE showing "Review & pay". LiteAPI
  // can call a fare sold out (52010) moments after a search, and people only
  // found out after opening checkout. Now Atlas finds out first and offers
  // the next option in chat. Any other failure (timeout, hiccup) doesn't
  // block the card: checkout re-checks the fare anyway.
  if (opt.kind === "flight") {
    try {
      await verifyFlightOffer(opt.raw.offerId);
    } catch (err) {
      const code =
        err?.code ??
        err?.response?.data?.error?.code ??
        err?.data?.error?.code ??
        null;
      const text = `${err?.message || ""} ${JSON.stringify(
        err?.response?.data || err?.data || {}
      )}`;
      if (Number(code) === 52010 || /sold out/i.test(text)) {
        optionCache.delete(optionId);
        return {
          error: "soldOut",
          message:
            "The airline says this fare just sold out, so it can't be booked. Tell the traveler plainly, then offer the next-best option from the same search (call open_checkout with that optionId if they pick it), or offer to search again.",
        };
      }
      if (Number(code) === 42005 || /not found|expired/i.test(text)) {
        optionCache.delete(optionId);
        return {
          error: "expired",
          message:
            "This price expired with the airline. Search again with the same details to get a fresh price, then offer it to the traveler.",
        };
      }
      console.warn(
        "[Atlas open_checkout] fare check failed, showing the card anyway:",
        code || err?.message
      );
    }
  }

  const handoff = await AtlasCheckoutHandoff.create({
    handoffId: crypto.randomBytes(12).toString("base64url"),
    kind: opt.kind,
    user: userId || null,
    offerId: opt.raw.offerId,
    // Exactly what the checkout page expects, plus how many travelers the
    // fare is priced for. Checkout opened with a different number of
    // travelers (e.g. 1 typed in, fare for 2) and the airline rejected it,
    // which showed up as "the airline doesn't accept my name".
    offer:
      opt.kind === "flight"
        ? {
            ...opt.raw.frontend,
            pricedFor: {
              adults: Math.max(1, Number(opt.search?.adults) || 1),
              children: Math.max(0, Number(opt.search?.children) || 0),
            },
          }
        : opt.raw.frontend,
    display: opt.display,
    search: opt.search,
    expiresAt: new Date(opt.expiresAt),
  });

  if (userId) {
    const shown = searchGroups.get(opt.display.searchId);
    if (shown)
      learnFromChoice(userId, opt.kind, shown, opt.display).catch(() => {});
  }

  const d = opt.display;
  const title =
    opt.kind === "flight"
      ? `${opt.search.origin} → ${opt.search.destination} · ${d.airline}`
      : d.hotel;
  const lines =
    opt.kind === "flight"
      ? [
          `${opt.search.departDate}${
            opt.search.returnDate ? ` – ${opt.search.returnDate}` : " · one way"
          }`,
          `${d.stops === 0 ? "Nonstop" : `${d.stops} stop(s)`}${
            d.duration ? ` · ${d.duration}` : ""
          }`,
          `Bags: ${d.includedBags}`,
        ]
      : [
          `${opt.search.checkin} – ${opt.search.checkout}`,
          [d.room, d.board].filter(Boolean).join(" · "),
          d.refundable ? "Refundable" : "Non-refundable",
        ].filter(Boolean);
  const travelers = (opt.search.adults || 1) + (opt.search.children || 0);

  return {
    handoffId: handoff.handoffId,
    card: {
      type: "checkout_link",
      kind: opt.kind,
      url: checkoutUrl(handoff.handoffId),
      title,
      lines,
      travelers,
      // Search price. The checkout page re-checks it before payment.
      price: opt.kind === "flight" ? d.price : d.total,
      currency: d.currency || "USD",
      expiresAt: handoff.expiresAt,
    },
    instruction:
      "Tell the user a Review & pay card is below. It opens checkout in a new tab where they add traveler details and pay. The price is held for a short time and is re-checked at checkout. Do not paste the link and do not say it's booked.",
  };
}

// ───────────────────────── Cars (Duffel, pay at pickup) ─────────────────────────

const CAR_TYPE_MATCH = {
  small: (c) => /mini|economy|compact/i.test(c.car.category || ""),
  midsize: (c) => /midsize|standard|full/i.test(c.car.category || "") && c.car.type !== "SUV",
  suv: (c) => c.car.type === "SUV",
  van: (c) => /van|pickup/i.test(c.car.type || ""),
  premium: (c) => /premium|luxury/i.test(c.car.category || ""),
};

async function runCarSearch(owner, input) {
  const badDate = checkDates([
    ["Pick-up date", input.pickupDate],
    ["Drop-off date", input.dropoffDate],
  ]);
  if (badDate) return badDate;
  const search = {
    location: String(input.location || "").trim().toUpperCase(),
    pickupDate: input.pickupDate,
    dropoffDate: input.dropoffDate,
    pickupTime: input.pickupTime || "10:00",
    dropoffTime: input.dropoffTime || "10:00",
    driverAge: Number(input.driverAge) || 30,
  };
  let found;
  try {
    found = await searchCars(search);
  } catch (err) {
    if (err instanceof CarSearchError) return { error: err.message };
    console.error("[Atlas search_cars] failed:", err.message);
    return { error: "Car search failed. Try again in a moment." };
  }
  const match = CAR_TYPE_MATCH[input.carType] || (() => true);
  const cars = found.cars
    .filter(match)
    .filter((c) => !input.maxTotal || c.totalAmount <= input.maxTotal)
    .slice(0, 5);
  if (!cars.length) {
    return {
      options: [],
      note: "No cars matched. Suggest other dates, another car type, or a nearby airport.",
    };
  }
  return {
    pickupPlace: found.place?.name || search.location,
    days: found.days,
    options: cars.map((c) => {
      const display = {
        company: c.supplier.name,
        car: c.car.name,
        category: c.car.category,
        type: c.car.type,
        seats: c.car.passengers,
        bags: c.car.bags,
        mileage: c.mileage,
        pickupCounter: c.pickup.name,
        counterAccess: c.pickup.access,
        total: c.totalAmount,
        perDay: c.perDay,
        currency: c.currency,
        payment: "Pay the rental company at pickup. Skyrio charges nothing.",
      };
      return {
        optionId: cacheOption(owner, "car", { rateId: c.id, offer: c }, display, search),
        ...display,
      };
    }),
    note: "All car rentals are paid at pickup. To book one, call open_checkout with its optionId.",
  };
}

function openCarCheckout(opt) {
  const s = opt.search;
  const d = opt.display;
  const qs = new URLSearchParams({
    tab: "Cars",
    to: s.location,
    depart: s.pickupDate,
    return: s.dropoffDate,
    ptime: s.pickupTime,
    dtime: s.dropoffTime,
    age: String(s.driverAge),
    carRate: opt.raw.rateId,
    auto: "1",
  });
  return {
    card: {
      type: "checkout_link",
      kind: "car",
      url: `${FRONTEND_URL}/booking?${qs}`,
      title: `${d.company} · ${d.car}`,
      lines: [
        "No payment now — pay at pickup",
        `${s.pickupDate} ${s.pickupTime} → ${s.dropoffDate} ${s.dropoffTime}`,
        [d.pickupCounter, d.counterAccess].filter(Boolean).join(" · "),
      ].filter(Boolean),
      travelers: 1,
      price: d.total,
      currency: d.currency || "USD",
      expiresAt: new Date(opt.expiresAt),
    },
    instruction:
      "Tell the user a card is below that opens the car's checkout, where they add the driver's details and book. Nothing is charged by Skyrio: they pay the rental company at pickup. Do not say it's booked.",
  };
}

// ───────────────────────── Events (Ticketmaster) ─────────────────────────

async function runEventSearch(owner, input) {
  const start = input.startDate;
  const end = input.endDate || (ISO_DAY.test(String(start || "")) ? addDays(start, 7) : null);
  const badDate = checkDates([
    ["Start date", start],
    ["End date", end],
  ]);
  if (badDate) return badDate;
  if (end < start) return { error: "End date is before the start date." };
  if (!process.env.TICKETMASTER_API_KEY) return { error: "Event search isn't available right now." };
  const category = input.category && input.category !== "all" ? EVENT_CATEGORIES[input.category] : undefined;
  let data;
  try {
    data = await searchEvents({
      city: String(input.city || "").trim(),
      stateCode: input.stateCode || undefined,
      startDateTime: toTmDateTime(start),
      endDateTime: toTmDateTime(end, true),
      classificationName: category,
      keyword: input.keyword ? String(input.keyword).slice(0, 100) : undefined,
      size: 20,
    });
  } catch (err) {
    console.error("[Atlas search_events] failed:", err.message);
    return { error: "Event search failed. Try again in a moment." };
  }
  const events = (data?._embedded?.events || [])
    .map(normalizeEvent)
    .filter((e) => !["cancelled", "canceled", "offsale"].includes(e.status))
    .slice(0, 6);
  if (!events.length) {
    return { options: [], note: "No events found. Suggest other dates or a nearby city." };
  }
  return {
    options: events.map((e) => {
      const display = {
        name: e.name,
        date: e.date,
        time: e.time,
        venue: e.venue?.name || null,
        city: e.venue?.city || null,
        category: e.genre || e.category,
        priceFrom: e.priceRange?.min ?? null, // null = Ticketmaster didn't list a price
        status: e.status === "postponed" || e.status === "rescheduled" ? e.status : null,
      };
      return { optionId: cacheOption(owner, "event", e, display, { city: input.city }), ...display };
    }),
    note: "Tickets are sold on Ticketmaster. Only mention a price if priceFrom is set. Use show_event to show a card for one.",
  };
}

function showEvent(owner, { optionId }) {
  const opt = getOption(owner, optionId);
  if (!opt || opt.kind !== "event") return { error: "That event option expired. Search events again." };
  const e = opt.raw;
  if (!/^https:\/\//.test(String(e.url || ""))) {
    return { error: "Ticketmaster didn't give a ticket link for this event." };
  }
  return {
    card: {
      type: "event",
      name: e.name,
      date: e.date,
      time: e.time,
      venue: e.venue?.name || null,
      city: e.venue?.city || null,
      state: e.venue?.state || null,
      image: e.image || null,
      url: e.url,
      priceFrom: e.priceRange?.min ?? null,
      currency: e.priceRange?.currency || "USD",
      tripDates: e.suggestedDates || null,
    },
    instruction:
      "Tell the user the event card is below: 'Buy on Ticketmaster' opens Ticketmaster to buy tickets (Skyrio doesn't sell tickets), and 'Plan a trip around it' asks you to find flights and a hotel for those dates.",
  };
}

// ───────────────────────── Adapter for your existing Atlas tool loop ─────────────────────────

const BOOKING_TOOL_NAMES = new Set(ATLAS_BOOKING_TOOLS.map((t) => t.name));
export const isBookingTool = (name) => BOOKING_TOOL_NAMES.has(name);

// Same shape as runAtlasTool in services/atlasTools.js: { result, action? }
export async function runBookingTool(
  name,
  input,
  { userId, guestKey, ip } = {}
) {
  if (!userId) {
    if (!GUEST_TOOL_NAMES.has(name)) {
      return {
        result: {
          error:
            "That needs an account. Offer to search and send them to checkout instead.",
        },
      };
    }
    if (!guestKey) {
      return {
        result: {
          error:
            "Couldn't identify this browser. Ask the user to refresh the page and try again.",
        },
      };
    }
  }
  const owner = userId ? String(userId) : `g:${guestKey}`;
  try {
    const result = await runBookingToolRaw(name, input || {}, {
      userId,
      owner,
      ip,
    });

    if (name === "show_event" && result?.card) {
      const { card, ...forModel } = result;
      return { result: forModel, action: card };
    }

    if (name === "open_checkout" && result?.card) {
      const { card, ...forModel } = result;
      return { result: forModel, action: card };
    }

    if (name === "propose_booking" && result?.proposalId) {
      return {
        result,
        action: { type: "booking", proposalId: result.proposalId },
      };
    }
    if (name === "start_profile_setup" && result?.card === "profile_setup") {
      return {
        result,
        action: {
          type: "profile_setup",
          focus: result.focus,
          travelerId: result.travelerId,
          reason: result.reason,
        },
      };
    }
    return { result };
  } catch (err) {
    console.error(`[Atlas booking tool] ${name} failed:`, err.message);
    return {
      result: { error: "That didn't work just now. Try again in a moment." },
    };
  }
}
