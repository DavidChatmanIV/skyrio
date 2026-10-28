// backend/services/atlas/atlasBookingTools.js
// Tools Atlas (Claude API, tool use) can call to search and PROPOSE bookings.
// There is deliberately NO "book" or "pay" tool. Paying only happens from the
// user's tap on the confirm card -> POST /api/atlas/proposals/:id/confirm.
//
// Wire-up (already done in the updated routes/atlas chat file):
//   tools = [...ATLAS_SUPPORT_TOOLS, ...ATLAS_BOOKING_TOOLS]
//   isBookingTool(name) ? runBookingTool(name, args, { userId }) : runAtlasTool(...)
// runBookingTool returns { result, action } just like your services/atlasTools.js,
// so the chat panel gets a "booking" or "profile_setup" card the same way it gets "cancel".
//
// The provider imports below point at the functions your existing checkout
// already uses. Rename them to match your files.
import AtlasBookingProposal from "../../models/AtlasBookingProposal.js";
import User from "../../models/user.js";
import { firstNameOf } from "./userName.js";
import SyncTrip from "../../models/SyncTrip.js";
import {
  searchFlights,        // your LiteAPI flight search (returns offers with offerId)
  verifyFlightOffer,    // POST /v3.0/flights/verify  { offerID }
  createFlightPrebook,  // POST /v3.0/flights/prebooks { offerId, passengers, contact, ... }
} from "../../providers/liteapi/flights.js";
import {
  searchHotelRates,     // POST /hotels/rates
  createHotelPrebook,   // POST /rates/prebook { offerId }
} from "../../providers/liteapi/hotels.js";
import {
  buildPassengersFromProfile,
  buildHotelGuestsFromProfile,
  IncompleteProfileError,
} from "./travelerProfile.js";
import crypto from "crypto";
import { rankForUser, learnFromChoice, rememberStated, forgetStated } from "./atlasLearning.js";
import { LEARNING_CATEGORIES } from "../../models/AtlasLearnedPreference.js";

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
          description: "Which step to open on. Use 'full' for a brand-new profile.",
        },
        travelerId: { type: "string", description: "A saved traveler whose profile is incomplete, if fixing one person" },
        reason: { type: "string", description: "One short line shown on the card, e.g. 'To book your Miami flight'" },
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
        seatPreference: { type: "string", enum: ["window", "aisle", "no_preference"] },
        cabin: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
        hotelPrefs: {
          type: "object",
          properties: {
            bedType: { type: "string", enum: ["king", "queen", "two_beds", "no_preference"] },
            maxNightly: { type: "number" },
            mustHave: { type: "array", items: { type: "string" }, description: "e.g. pool, free breakfast, gym" },
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
        text: { type: "string", description: "Short plain sentence, e.g. 'Avoids red-eye flights'" },
      },
      required: ["category", "text"],
    },
  },
  {
    name: "forget_preference",
    description: "Forget something you learned about the traveler when they say it's wrong or no longer true.",
    parameters: {
      type: "object",
      properties: { match: { type: "string", description: "A few words from the thing to forget" } },
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
        returnDate: { type: "string", description: "YYYY-MM-DD, omit for one-way" },
        adults: { type: "integer", minimum: 1 },
        children: { type: "integer", minimum: 0 },
        cabin: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
        maxPrice: { type: "number", description: "Optional budget cap in USD" },
      },
      required: ["origin", "destination", "departDate", "adults"],
    },
  },
  {
    name: "search_hotels",
    description: "Search hotel rates. Returns up to 5 options with an optionId for each.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", description: "City or place name" },
        checkin: { type: "string", description: "YYYY-MM-DD" },
        checkout: { type: "string", description: "YYYY-MM-DD" },
        adults: { type: "integer", minimum: 1 },
        children: { type: "integer", minimum: 0 },
        rooms: { type: "integer", minimum: 1 },
        maxNightly: { type: "number", description: "Optional nightly budget cap in USD" },
      },
      required: ["destination", "checkin", "checkout", "adults"],
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
        optionId: { type: "string", description: "optionId from search_flights, search_hotels, or get_sync_trip" },
        travelerIds: {
          type: "array",
          items: { type: "string" },
          description: "Saved traveler ids from get_traveler_profile. Use 'self' for the user.",
        },
        syncTripId: { type: "string" },
        sharedRoomId: { type: "string", description: "Sync Together shared room to join, if any" },
      },
      required: ["optionId", "travelerIds"],
    },
  },
];

// ───────────────────────── Option cache ─────────────────────────
// The model only ever sees short optionIds. Real offerIds/prices stay server-side,
// so Atlas can't invent a price or swap in an offer the user never saw.
const optionCache = new Map(); // optionId -> { userId, kind, offerId, display, expiresAt }
const OPTION_TTL_MS = 13 * 60 * 1000;

function cacheOption(userId, kind, raw, display) {
  const optionId = `${kind[0]}_${Math.random().toString(36).slice(2, 10)}`;
  optionCache.set(optionId, { userId: String(userId), kind, raw, display, expiresAt: Date.now() + OPTION_TTL_MS });
  return optionId;
}

function getOption(userId, optionId) {
  const opt = optionCache.get(optionId);
  if (!opt || opt.userId !== String(userId)) return null;
  if (Date.now() > opt.expiresAt) {
    optionCache.delete(optionId);
    return null;
  }
  return opt;
}

// ───────────────────────── Tool handlers ─────────────────────────

async function runBookingToolRaw(name, input, { userId }) {
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
      return runFlightSearch(userId, input);
    case "search_hotels":
      return runHotelSearch(userId, input);
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
        if (err.code === 42005) return { error: "That price expired. Search again for a fresh one." };
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
  const selfMissing = ["legalLastName", "dateOfBirth", "phone"].filter((k) => !p[k]);
  const hasSavedCard = Boolean(user.stripeCustomerId && user.defaultPaymentMethodId);
  return {
    profileStatus:
      selfMissing.length === 0 && hasSavedCard ? "ready" : !p.legalLastName && !p.dateOfBirth ? "new" : "incomplete",
    missing: [
      ...selfMissing.map((k) => ({ legalLastName: "legal name", dateOfBirth: "date of birth", phone: "phone" })[k]),
      ...(hasSavedCard ? [] : ["saved card"]),
    ],
    homeAirport: user.homeAirport?.code || null, // your existing Digital Passport field
    seatPreference: p.seatPreference || null, // "window" | "aisle"
    cabin: p.cabin || "economy",
    hotelPrefs: p.hotelPrefs || null,
    hasSavedCard,
    // First names + ids only. Passport/DOB/KTN never go to the model.
    travelers: [
      { id: "self", firstName: p.legalFirstName || firstNameOf(user), profileComplete: Boolean(p.dateOfBirth && p.legalLastName) },
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
    if (!IATA.test(code)) return { error: "Home airport must be a 3-letter airport code like EWR." };
    set["homeAirport.code"] = code; // same field the Digital Passport uses
  }
  if (input.seatPreference) set["travelProfile.seatPreference"] = input.seatPreference;
  if (input.cabin) set["travelProfile.cabin"] = input.cabin;
  if (input.hotelPrefs) set["travelProfile.hotelPrefs"] = input.hotelPrefs;
  if (!Object.keys(set).length) return { error: "Nothing to save." };

  await User.updateOne({ _id: userId }, { $set: set });
  return { saved: Object.keys(set).map((k) => k.replace("travelProfile.", "")) };
}

// Remembers what was shown in each search so a pick can teach Atlas something
const searchGroups = new Map(); // searchId -> [display, ...]

async function runFlightSearch(userId, input) {
  const offers = await searchFlights(input);
  const candidates = offers
    .filter((o) => !input.maxPrice || o.price.total <= input.maxPrice)
    .slice(0, 15)
    .map((o) => ({
      _raw: o,
      airline: o.airlineName,
      airlineCode: o.airlineCode,
      flightNumbers: o.segments.map((s) => s.flightNumber).join(", "),
      depart: o.segments[0].departTime,
      arrive: o.segments.at(-1).arriveTime,
      stops: o.segments.length - 1,
      duration: o.durationText,
      price: o.price.total,
      currency: o.price.currency,
      includedBags: o.baggageSummary || "Not listed by airline",
    }));

  // Put options this traveler tends to pick first
  const ranked = (await rankForUser(userId, "flight", candidates)).slice(0, 5);
  const searchId = crypto.randomUUID();
  searchGroups.set(searchId, ranked.map(({ _raw, ...d }) => d));
  setTimeout(() => searchGroups.delete(searchId), OPTION_TTL_MS).unref?.();

  return {
    options: ranked.map(({ _raw, ...display }) => ({
      optionId: cacheOption(userId, "flight", _raw, { ...display, searchId }),
      ...display,
    })),
    note: "Prices are live and expire in about 13 minutes. Options with whyForYou match this traveler's usual picks.",
  };
}

async function runHotelSearch(userId, input) {
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

  const ranked = (await rankForUser(userId, "hotel", candidates)).slice(0, 5);
  const searchId = crypto.randomUUID();
  searchGroups.set(searchId, ranked.map(({ _raw, ...d }) => d));
  setTimeout(() => searchGroups.delete(searchId), OPTION_TTL_MS).unref?.();

  return {
    options: ranked.map(({ _raw, ...display }) => ({
      optionId: cacheOption(userId, "hotel", _raw, { ...display, searchId }),
      ...display,
    })),
  };
}

async function getSyncTripForAtlas(userId, syncTripId) {
  const trip = await SyncTrip.findById(syncTripId).lean();
  if (!trip) return { error: "Group trip not found" };

  const me = trip.members.find((m) => String(m.user) === String(userId));
  if (!me) return { error: "You're not a member of this trip" };

  // Re-check friends' flights so Atlas never offers one that's gone
  const groupFlights = [];
  for (const f of trip.bookedFlights || []) {
    const fresh = await searchFlights({
      origin: f.origin,
      destination: f.destination,
      departDate: f.departDate,
      adults: 1,
      flightNumbers: f.flightNumbers,
    }).catch(() => []);
    const match = fresh[0];
    groupFlights.push({
      bookedBy: f.memberFirstName,
      flightNumbers: f.flightNumbers.join(", "),
      depart: f.departTime,
      stillAvailable: Boolean(match),
      ...(match && {
        optionId: cacheOption(userId, "flight", match, {
          airline: match.airlineName,
          airlineCode: match.airlineCode,
          flightNumbers: match.segments.map((s) => s.flightNumber).join(", "),
          depart: match.segments[0].departTime,
          stops: match.segments.length - 1,
          duration: match.durationText,
          includedBags: match.baggageSummary || "Not listed by airline",
          price: match.price.total,
          fromGroup: true, // joining friends' flight is a group choice, not a personal habit
        }),
        price: match.price.total,
        currency: match.price.currency,
      }),
    });
  }

  return {
    name: trip.name,
    destination: trip.destination,
    dates: { start: trip.startDate, end: trip.endDate },
    myStatus: me.paymentStatus, // "unpaid" | "paid" | ...
    myBudget: me.privateBudget ?? null, // only the requesting user's own budget
    groupFlights: groupFlights.filter((g) => g.stillAvailable),
    hotel: trip.hotel
      ? {
          name: trip.hotel.name,
          sharedRooms: (trip.hotel.rooms || []).map((r) => ({
            sharedRoomId: r.id,
            roomName: r.name,
            spotsLeft: r.capacity - r.occupants.length,
            myShare: r.perPersonShare,
          })),
        }
      : null,
  };
}

function partyFromTravelers(user, travelerIds) {
  const companions = new Map((user.travelProfile?.companions || []).map((c) => [String(c._id), c]));
  let adults = 0;
  let children = 0;
  for (const id of travelerIds) {
    if (id === "self") adults++;
    else if (companions.get(id)?.relation === "child") children++;
    else adults++;
  }
  return { adults, children };
}

async function proposeBooking(userId, { optionId, travelerIds, syncTripId, sharedRoomId }) {
  const opt = getOption(userId, optionId);
  if (!opt) return { error: "That option expired. Search again to get a fresh price." };

  const user = await User.findById(userId).lean();
  if (!user?.defaultPaymentMethodId) {
    return {
      error: "No saved card yet.",
      fix: "Call start_profile_setup with focus 'card' so the user can add one right here.",
    };
  }

  // Sync Together guardrails: only the user's own share, and only if they're a member
  if (syncTripId) {
    const trip = await SyncTrip.findById(syncTripId).lean();
    const me = trip?.members.find((m) => String(m.user) === String(userId));
    if (!me) return { error: "You're not a member of this trip" };
    if (travelerIds.some((id) => id !== "self" && !me.companionIds?.includes(id))) {
      return { error: "In a group trip, Atlas can only book your own share (and companions you added to the trip)." };
    }
  }

  let prebook;
  let summary;

  if (opt.kind === "flight") {
    const passengers = await buildPassengersFromProfile(userId, travelerIds); // throws if a profile is incomplete
    await verifyFlightOffer(opt.raw.offerId);
    prebook = await createFlightPrebook({ offerId: opt.raw.offerId, passengers, contact: { email: user.email } });
    summary = {
      title: `${opt.raw.segments[0].origin} → ${opt.raw.segments.at(-1).destination} · ${opt.display.depart}`,
      lines: [
        `${opt.display.airline} ${opt.display.flightNumbers}`,
        `${opt.display.stops === 0 ? "Nonstop" : `${opt.display.stops} stop(s)`} · ${opt.display.duration}`,
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
      lines: [opt.display.room, opt.display.board, sharedRoomId ? "Your share of a shared room" : null].filter(Boolean),
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
            hotel: { nightly: opt.display.nightly, starRating: opt.display.starRating },
            party: partyFromTravelers(user, travelerIds),
            groupTrip: Boolean(syncTripId),
            // A shared room or the group's hotel is picked with friends, not alone
            followedGroup: Boolean(sharedRoomId),
          },
  });

  optionCache.delete(optionId);

  // Learn from what they picked vs. what else they saw (non-blocking)
  const shown = searchGroups.get(opt.display.searchId);
  if (shown) learnFromChoice(userId, opt.kind, shown, opt.display).catch(() => {});

  // The chat frontend renders this as <AtlasBookingCard proposalId=... />
  return {
    proposalId: String(proposal._id),
    total,
    currency: prebook.price.currency,
    expiresInMinutes: 12,
    instruction: "Tell the user to review the card and tap Confirm & Pay. Do not say it's booked.",
  };
}

// ───────────────────────── Adapter for your existing Atlas tool loop ─────────────────────────

const BOOKING_TOOL_NAMES = new Set(ATLAS_BOOKING_TOOLS.map((t) => t.name));
export const isBookingTool = (name) => BOOKING_TOOL_NAMES.has(name);

// Same shape as runAtlasTool in services/atlasTools.js: { result, action? }
export async function runBookingTool(name, input, { userId }) {
  if (!userId) return { result: { error: "Sign in to book with Atlas." } };
  try {
    const result = await runBookingToolRaw(name, input || {}, { userId });

    if (name === "propose_booking" && result?.proposalId) {
      return { result, action: { type: "booking", proposalId: result.proposalId } };
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
    return { result: { error: "That didn't work just now. Try again in a moment." } };
  }
}
