/**
 * atlasActions.js
 * ─────────────────────────────────────────────────────────────
 * Atlas Actions Engine — the "hands" that let Atlas DO things.
 *
 * Each action has:
 *   - A tool definition (sent to the AI provider)
 *   - An executor function (runs when the AI invokes the tool)
 *
 * Drop into:  backend/services/atlasActions.js
 * ─────────────────────────────────────────────────────────────
 */

import Booking from "../models/booking.js";
import User from "../models/user.js";
import Stripe from "stripe";
import { duffel } from "../routes/api/flights/duffel.provider.js";

// ─── Stripe client ────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ═════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// Provider-agnostic format — converted to OpenAI / Claude
// format by atlasService.js before sending.
// ═════════════════════════════════════════════════════════════

export const ATLAS_TOOLS = [
  {
    name: "list_user_bookings",
    description:
      "Retrieve all bookings for the current user. Use this when the user asks about their trips, bookings, reservations, or upcoming travel. Returns flights, hotels, car rentals, and packages.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "upcoming", "past", "cancelled"],
          description:
            "Filter bookings by status. Default 'all'. Use 'upcoming' for future trips, 'past' for completed ones.",
        },
        limit: {
          type: "number",
          description: "Max bookings to return. Default 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_booking_details",
    description:
      "Get full details of a specific booking by its ID. Use when the user references a specific trip or booking, or after list_user_bookings to drill into one result.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The MongoDB booking ID.",
        },
      },
      required: ["bookingId"],
    },
  },
  {
    name: "check_cancellation_policy",
    description:
      "Check the cancellation policy and refund eligibility for a booking BEFORE cancelling. Always call this before cancel_booking so you can inform the user of any fees or penalties.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The booking ID to check.",
        },
      },
      required: ["bookingId"],
    },
  },
  {
    name: "cancel_booking",
    description:
      "Cancel a booking (flight, hotel, or car rental). IMPORTANT: Always call check_cancellation_policy first and get user confirmation before cancelling. This action is irreversible for flights.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The booking ID to cancel.",
        },
        reason: {
          type: "string",
          description: "Reason for cancellation. Helps with refund processing.",
        },
        confirmCancel: {
          type: "boolean",
          description:
            "Must be true. Set to true only AFTER the user has explicitly confirmed they want to cancel.",
        },
      },
      required: ["bookingId", "confirmCancel"],
    },
  },
  {
    name: "request_refund",
    description:
      "Process a refund through Stripe for a cancelled booking. Only call after a booking has been successfully cancelled. Supports full or partial refunds.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The cancelled booking ID.",
        },
        refundType: {
          type: "string",
          enum: ["full", "partial"],
          description: "Whether to refund the full amount or a partial amount.",
        },
        amount: {
          type: "number",
          description:
            "Amount in dollars to refund (required for partial refunds). Ignored for full refunds.",
        },
        reason: {
          type: "string",
          enum: ["requested_by_customer", "duplicate", "fraudulent", "other"],
          description: "Stripe refund reason. Default: requested_by_customer.",
        },
      },
      required: ["bookingId", "refundType"],
    },
  },
  {
    name: "search_alternative_flights",
    description:
      "Search for alternative flights when a user wants to switch their flight. Use the original booking's route and find new options.",
    parameters: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Origin airport IATA code (e.g. 'JFK').",
        },
        destination: {
          type: "string",
          description: "Destination airport IATA code (e.g. 'LAX').",
        },
        departDate: {
          type: "string",
          description: "New departure date in YYYY-MM-DD format.",
        },
        returnDate: {
          type: "string",
          description:
            "New return date in YYYY-MM-DD format. Omit for one-way.",
        },
        adults: {
          type: "number",
          description: "Number of adult passengers. Default 1.",
        },
        cabin: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
          description: "Cabin class. Default economy.",
        },
        maxResults: {
          type: "number",
          description: "Max results to return. Default 5.",
        },
      },
      required: ["origin", "destination", "departDate"],
    },
  },
  {
    name: "switch_booking",
    description:
      "Switch a flight booking to a new one. This cancels the old booking and creates a new one. Always search for alternatives first, show the user options, and get explicit confirmation before switching.",
    parameters: {
      type: "object",
      properties: {
        oldBookingId: {
          type: "string",
          description: "The booking ID to cancel/replace.",
        },
        newFlightOfferId: {
          type: "string",
          description:
            "The Duffel offer ID for the new flight (from search_alternative_flights results).",
        },
        confirmSwitch: {
          type: "boolean",
          description:
            "Must be true. Only after the user explicitly confirms the switch.",
        },
      },
      required: ["oldBookingId", "newFlightOfferId", "confirmSwitch"],
    },
  },
  {
    name: "lookup_travel_info",
    description:
      "Look up general travel information, policies, FAQs, visa requirements, baggage rules, or anything the user asks about Skyrio's services. Use this for ANY question you can't answer from context alone — always try this before saying you don't know.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The user's question or topic to look up.",
        },
        category: {
          type: "string",
          enum: [
            "cancellation_policy",
            "refund_policy",
            "baggage",
            "visa",
            "check_in",
            "payment",
            "account",
            "loyalty",
            "general",
          ],
          description: "Category to narrow the search.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate to a human support agent. Use ONLY as a last resort when: (1) the issue requires manual backend intervention, (2) involves a dispute over $500, (3) the user explicitly demands a human, or (4) you've exhausted all other tools and still can't resolve the issue.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Clear description of why this needs human attention.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description:
            "Priority level. Use 'urgent' for stranded travelers or disputes.",
        },
        bookingId: {
          type: "string",
          description: "Related booking ID, if applicable.",
        },
      },
      required: ["reason", "priority"],
    },
  },
];

// ═════════════════════════════════════════════════════════════
// ACTION EXECUTORS
// Each function receives (params, userId) and returns a result
// object that gets fed back to Atlas as tool output.
// ═════════════════════════════════════════════════════════════

const executors = {
  // ── List user bookings ────────────────────────────────────
  async list_user_bookings({ status = "all", limit = 10 }, userId) {
    const filter = { user: userId };
    const now = new Date();

    if (status === "upcoming") {
      filter["dates.start"] = { $gte: now };
      filter.status = { $ne: "cancelled" };
    } else if (status === "past") {
      filter["dates.end"] = { $lt: now };
    } else if (status === "cancelled") {
      filter.status = "cancelled";
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("hotel")
      .populate("flight")
      .populate("place")
      .lean();

    if (bookings.length === 0) {
      return {
        success: true,
        data: [],
        message: "No bookings found matching that filter.",
      };
    }

    // Summarize for Atlas (keep tokens lean)
    const summaries = bookings.map((b) => ({
      id: b._id.toString(),
      type: b.flight
        ? "flight"
        : b.hotel
        ? "hotel"
        : b.package
        ? "package"
        : "other",
      status: b.status || "confirmed",
      destination: b.place?.name || b.flight?.destination || "Unknown",
      dates: b.dates || {},
      travelers: b.travelers || 1,
      createdAt: b.createdAt,
      flight: b.flight
        ? {
            airline: b.flight.owner || b.flight.airline,
            origin: b.flight.origin,
            destination: b.flight.destination,
            departDate: b.flight.departingAt,
            price: b.flight.totalAmount,
            currency: b.flight.totalCurrency,
            stops: b.flight.stops,
            duffelOrderId: b.flight.duffelOrderId,
          }
        : null,
      hotel: b.hotel
        ? {
            name: b.hotel.name,
            city: b.hotel.city,
            checkIn: b.hotel.checkIn,
            checkOut: b.hotel.checkOut,
            price: b.hotel.totalPrice,
          }
        : null,
      payment: {
        stripePaymentIntentId: b.stripePaymentIntentId || null,
        amount: b.totalAmount || b.flight?.totalAmount,
        currency: b.totalCurrency || b.flight?.totalCurrency || "USD",
      },
    }));

    return {
      success: true,
      count: summaries.length,
      data: summaries,
    };
  },

  // ── Get booking details ───────────────────────────────────
  async get_booking_details({ bookingId }, userId) {
    const booking = await Booking.findOne({ _id: bookingId, user: userId })
      .populate("hotel")
      .populate("flight")
      .populate("place")
      .populate("package")
      .lean();

    if (!booking) {
      return { success: false, error: "Booking not found or access denied." };
    }

    return { success: true, data: booking };
  },

  // ── Check cancellation policy ─────────────────────────────
  async check_cancellation_policy({ bookingId }, userId) {
    const booking = await Booking.findOne({ _id: bookingId, user: userId })
      .populate("flight")
      .populate("hotel")
      .lean();

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.status === "cancelled") {
      return {
        success: false,
        error: "This booking is already cancelled.",
      };
    }

    const result = {
      success: true,
      bookingId,
      type: booking.flight ? "flight" : booking.hotel ? "hotel" : "other",
      canCancel: true,
      refundEligible: true,
      refundType: "full",
      fees: 0,
      warnings: [],
    };

    // ── Flight-specific policy ──
    if (booking.flight) {
      const departDate = new Date(
        booking.flight.departingAt || booking.dates?.start
      );
      const hoursUntilDeparture = (departDate - new Date()) / (1000 * 60 * 60);

      if (hoursUntilDeparture < 0) {
        result.canCancel = false;
        result.refundEligible = false;
        result.warnings.push("This flight has already departed.");
        return result;
      }

      if (hoursUntilDeparture < 24) {
        result.warnings.push(
          "Less than 24 hours until departure. Cancellation fee may apply."
        );
        result.refundType = "partial";
        result.fees = parseFloat(booking.flight.totalAmount || 0) * 0.2;
        result.estimatedRefund =
          parseFloat(booking.flight.totalAmount || 0) - result.fees;
      } else {
        // US DOT 24-hour rule: free cancellation within 24h of booking
        const hoursSinceBooking =
          (new Date() - new Date(booking.createdAt)) / (1000 * 60 * 60);

        if (hoursSinceBooking <= 24) {
          result.refundType = "full";
          result.estimatedRefund = parseFloat(booking.flight.totalAmount || 0);
          result.warnings.push(
            "Within 24-hour free cancellation window (DOT rule)."
          );
        } else {
          result.refundType = "full";
          result.estimatedRefund = parseFloat(booking.flight.totalAmount || 0);
        }
      }

      // Check with Duffel if we have an order ID
      if (booking.flight.duffelOrderId) {
        try {
          const order = await duffel.orders.get(booking.flight.duffelOrderId);
          if (order?.data) {
            result.duffelCancellable =
              order.data.cancellation?.refund_amount != null;
            if (order.data.cancellation?.refund_amount) {
              result.estimatedRefund = parseFloat(
                order.data.cancellation.refund_amount
              );
              result.refundCurrency =
                order.data.cancellation.refund_currency || "USD";
            }
          }
        } catch (err) {
          // Duffel lookup failed — use our estimate
          result.warnings.push(
            "Could not verify with airline — using estimated refund amount."
          );
        }
      }
    }

    // ── Hotel-specific policy ──
    if (booking.hotel) {
      const checkIn = new Date(booking.hotel.checkIn || booking.dates?.start);
      const hoursUntilCheckIn = (checkIn - new Date()) / (1000 * 60 * 60);

      if (hoursUntilCheckIn < 0) {
        result.canCancel = false;
        result.refundEligible = false;
        result.warnings.push("Check-in date has already passed.");
        return result;
      }

      if (hoursUntilCheckIn < 48) {
        result.refundType = "partial";
        result.fees = parseFloat(booking.hotel.totalPrice || 0) * 0.5;
        result.estimatedRefund =
          parseFloat(booking.hotel.totalPrice || 0) - result.fees;
        result.warnings.push(
          "Less than 48 hours until check-in. 50% cancellation fee applies."
        );
      } else {
        result.refundType = "full";
        result.estimatedRefund = parseFloat(booking.hotel.totalPrice || 0);
      }
    }

    return result;
  },

  // ── Cancel booking ────────────────────────────────────────
  async cancel_booking({ bookingId, reason, confirmCancel }, userId) {
    if (!confirmCancel) {
      return {
        success: false,
        error:
          "Cancellation not confirmed. Please ask the user to confirm before proceeding.",
      };
    }

    const booking = await Booking.findOne({ _id: bookingId, user: userId })
      .populate("flight")
      .populate("hotel");

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.status === "cancelled") {
      return { success: false, error: "Booking is already cancelled." };
    }

    // ── Cancel with Duffel if it's a flight ──
    let duffelCancellation = null;
    if (booking.flight?.duffelOrderId) {
      try {
        const cancellation = await duffel.orderCancellations.create({
          order_id: booking.flight.duffelOrderId,
        });
        // Confirm the cancellation
        if (cancellation?.data?.id) {
          await duffel.orderCancellations.confirm(cancellation.data.id);
          duffelCancellation = {
            id: cancellation.data.id,
            refundAmount: cancellation.data.refund_amount,
            refundCurrency: cancellation.data.refund_currency,
          };
        }
      } catch (err) {
        console.error(
          "[atlasActions] Duffel cancellation failed:",
          err.message
        );
        // Continue with local cancellation even if Duffel fails
        // (support can reconcile manually)
      }
    }

    // ── Update booking status in MongoDB ──
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || "User requested via Atlas";
    await booking.save();

    return {
      success: true,
      bookingId,
      status: "cancelled",
      duffelCancellation,
      message: "Booking has been cancelled successfully.",
      nextStep:
        "Ask the user if they would like a refund processed to their original payment method.",
    };
  },

  // ── Request refund ────────────────────────────────────────
  async request_refund(
    { bookingId, refundType, amount, reason = "requested_by_customer" },
    userId
  ) {
    const booking = await Booking.findOne({ _id: bookingId, user: userId })
      .populate("flight")
      .populate("hotel")
      .lean();

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    // Find the Stripe PaymentIntent
    const paymentIntentId =
      booking.stripePaymentIntentId || booking.paymentIntentId;

    if (!paymentIntentId) {
      return {
        success: false,
        error:
          "No payment record found for this booking. This may need manual processing. Please escalate to a human agent.",
      };
    }

    try {
      const refundParams = {
        payment_intent: paymentIntentId,
        reason,
      };

      if (refundType === "partial" && amount) {
        refundParams.amount = Math.round(amount * 100); // Stripe uses cents
      }

      const refund = await stripe.refunds.create(refundParams);

      // Update booking with refund info
      await Booking.findByIdAndUpdate(bookingId, {
        $set: {
          refundId: refund.id,
          refundStatus: refund.status,
          refundAmount: refund.amount / 100,
          refundedAt: new Date(),
        },
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status, // "succeeded" | "pending" | "failed"
        amount: refund.amount / 100,
        currency: refund.currency,
        message:
          refund.status === "succeeded"
            ? `Refund of $${(refund.amount / 100).toFixed(
                2
              )} ${refund.currency.toUpperCase()} processed successfully. It may take 5-10 business days to appear on the user's statement.`
            : `Refund of $${(refund.amount / 100).toFixed(2)} is ${
                refund.status
              }. The user will be notified when it completes.`,
      };
    } catch (err) {
      console.error("[atlasActions] Stripe refund failed:", err.message);
      return {
        success: false,
        error: `Refund processing failed: ${err.message}. Escalate to human support if this persists.`,
      };
    }
  },

  // ── Search alternative flights ────────────────────────────
  async search_alternative_flights(
    {
      origin,
      destination,
      departDate,
      returnDate,
      adults = 1,
      cabin = "economy",
      maxResults = 5,
    },
    _userId
  ) {
    try {
      const slices = [{ origin, destination, departure_date: departDate }];

      if (returnDate) {
        slices.push({
          origin: destination,
          destination: origin,
          departure_date: returnDate,
        });
      }

      const passengers = Array.from({ length: adults }).map(() => ({
        type: "adult",
      }));

      const offerRequest = await duffel.offerRequests.create({
        slices,
        passengers,
        cabin_class: cabin,
      });

      const offers = (offerRequest.data.offers ?? []).slice(0, maxResults);

      const results = offers.map((offer) => {
        const outbound = offer.slices?.[0];
        return {
          offerId: offer.id,
          airline: offer.owner?.name || "Unknown",
          origin: outbound?.origin?.iata_code || origin,
          destination: outbound?.destination?.iata_code || destination,
          departureTime: outbound?.segments?.[0]?.departing_at,
          arrivalTime:
            outbound?.segments?.[outbound.segments.length - 1]?.arriving_at,
          stops: (outbound?.segments?.length || 1) - 1,
          duration: outbound?.duration,
          price: parseFloat(offer.total_amount),
          currency: offer.total_currency,
          cabin: offer.cabin_class || cabin,
        };
      });

      return {
        success: true,
        count: results.length,
        data: results,
        message:
          results.length > 0
            ? `Found ${results.length} alternative flights.`
            : "No alternative flights found for those dates.",
      };
    } catch (err) {
      console.error("[atlasActions] Flight search failed:", err.message);
      return {
        success: false,
        error: `Flight search failed: ${err.message}`,
      };
    }
  },

  // ── Switch booking ────────────────────────────────────────
  async switch_booking(
    { oldBookingId, newFlightOfferId, confirmSwitch },
    userId
  ) {
    if (!confirmSwitch) {
      return {
        success: false,
        error: "Switch not confirmed by user. Ask them to confirm first.",
      };
    }

    // Step 1: Cancel the old booking
    const cancelResult = await executors.cancel_booking(
      {
        bookingId: oldBookingId,
        reason: "Switching to new flight",
        confirmCancel: true,
      },
      userId
    );

    if (!cancelResult.success) {
      return {
        success: false,
        error: `Could not cancel original booking: ${cancelResult.error}`,
      };
    }

    // Step 2: Create the new order with Duffel
    try {
      const order = await duffel.orders.create({
        selected_offers: [newFlightOfferId],
        type: "instant",
        payments: [
          {
            type: "balance",
            amount: "0", // Handled by Stripe on our side
            currency: "USD",
          },
        ],
      });

      // Step 3: Create a new booking in MongoDB
      const oldBooking = await Booking.findById(oldBookingId).lean();

      const newBooking = new Booking({
        user: userId,
        flight: {
          ...order.data.slices?.[0],
          duffelOrderId: order.data.id,
          totalAmount: order.data.total_amount,
          totalCurrency: order.data.total_currency,
        },
        dates: oldBooking?.dates,
        travelers: oldBooking?.travelers,
        status: "confirmed",
        switchedFrom: oldBookingId,
      });

      await newBooking.save();

      return {
        success: true,
        oldBookingId,
        newBookingId: newBooking._id.toString(),
        newDuffelOrderId: order.data.id,
        price: order.data.total_amount,
        currency: order.data.total_currency,
        message:
          "Flight switched successfully. The old booking has been cancelled and the new one is confirmed.",
        nextStep:
          "Check if a refund is owed for the price difference, or if additional payment is needed.",
      };
    } catch (err) {
      console.error(
        "[atlasActions] Switch failed at booking step:",
        err.message
      );
      return {
        success: false,
        error: `Cancelled old booking but failed to create new one: ${err.message}. ESCALATE to human support immediately.`,
        cancelledBookingId: oldBookingId,
        urgent: true,
      };
    }
  },

  // ── Lookup travel info / FAQ ──────────────────────────────
  async lookup_travel_info({ query, category = "general" }, _userId) {
    // ── Skyrio's knowledge base ──
    // In production, replace this with a vector DB or CMS lookup.
    // For now, this covers the essentials so Atlas can answer
    // 90%+ of common questions without escalating.

    const knowledgeBase = {
      cancellation_policy: {
        flights: [
          "Flights can be cancelled up until departure time.",
          "Cancellations within 24 hours of booking are free (US DOT rule).",
          "Cancellations within 24 hours of departure incur a 20% fee.",
          "Non-refundable fares cannot be refunded but may be eligible for airline credit.",
          "Refunds are processed to the original payment method within 5-10 business days.",
        ],
        hotels: [
          "Hotels can be cancelled up to 48 hours before check-in for a full refund.",
          "Cancellations within 48 hours of check-in incur a 50% fee (one night's stay).",
          "No-show bookings are not eligible for refunds.",
          "Some properties have stricter non-refundable policies — check the booking details.",
        ],
        cars: [
          "Car rentals can be cancelled up to 24 hours before pickup for a full refund.",
          "Late cancellations may incur a one-day rental fee.",
        ],
      },
      refund_policy: [
        "Refunds are processed through Stripe to the original payment method.",
        "Full refunds typically appear within 5-10 business days.",
        "Partial refunds may apply based on cancellation timing and provider policies.",
        "Disputes over $500 are escalated to the Skyrio support team for manual review.",
        "If a refund fails, it can be retried or issued as Skyrio credit.",
      ],
      baggage: [
        "Baggage policies vary by airline — check your booking confirmation for details.",
        "Most economy fares include one personal item. Carry-on and checked bags may cost extra.",
        "Duffel API bookings show included baggage in the offer details.",
        "If you need to add bags after booking, contact the airline directly or ask Atlas for help.",
      ],
      visa: [
        "Visa requirements depend on your nationality and destination.",
        "Atlas can provide general guidance but always verify with the destination country's embassy.",
        "Some countries offer visa-on-arrival or eVisa for eligible passport holders.",
        "Processing times vary — apply at least 4-6 weeks before travel.",
      ],
      check_in: [
        "Online check-in typically opens 24-48 hours before departure.",
        "Check your airline's app or website for the exact window.",
        "Hotel check-in times vary — most are 3:00 PM, but early check-in can be requested.",
        "Atlas can help you find check-in details from your booking.",
      ],
      payment: [
        "Skyrio accepts all major credit cards, debit cards, and Apple Pay via Stripe.",
        "Payments are processed in the currency shown at checkout.",
        "Your card is charged immediately upon booking confirmation.",
        "Payment issues? Try a different card or contact your bank if the charge is being declined.",
      ],
      account: [
        "You can update your profile, saved trips, and preferences from the Dashboard.",
        "To change your email or password, go to Settings.",
        "Your booking history is always available under My Bookings.",
        "Delete your account from Settings > Account > Delete Account. This is irreversible.",
      ],
      loyalty: [
        "Skyrio Passport rewards you with XP for every booking and interaction.",
        "XP unlocks tiers: Explorer, Adventurer, Globetrotter, and Legend.",
        "Higher tiers unlock perks like priority support, exclusive deals, and early access.",
        "Bookings earn 200 XP each. Hearts/saves earn 10 XP.",
      ],
      general: [
        "Skyrio is a next-generation travel booking platform with AI-powered trip planning.",
        "Atlas is your personal travel assistant — available 24/7 to help with any travel question.",
        "For issues Atlas can't resolve, a human support agent is always available.",
        "Report bugs or give feedback at support@skyrio.com or through the app.",
      ],
    };

    // Find relevant answers
    const categoryData = knowledgeBase[category] || knowledgeBase.general;
    let answers;

    if (Array.isArray(categoryData)) {
      answers = categoryData;
    } else {
      // Nested object (like cancellation_policy) — combine all
      answers = Object.values(categoryData).flat();
    }

    // Simple keyword match to rank relevance
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = answers.map((answer) => {
      const score = queryWords.reduce(
        (acc, word) => acc + (answer.toLowerCase().includes(word) ? 1 : 0),
        0
      );
      return { answer, score };
    });

    const relevant = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.answer);

    return {
      success: true,
      category,
      data: relevant,
      message:
        relevant.length > 0
          ? "Here is the relevant information from Skyrio's knowledge base."
          : "No specific information found. Consider rephrasing or escalating.",
    };
  },

  // ── Escalate to human ─────────────────────────────────────
  async escalate_to_human({ reason, priority, bookingId }, userId) {
    // In production: create a support ticket in your ticketing system.
    // For now: log it and return a ticket-like response.

    const ticketId = `ESC-${Date.now().toString(36).toUpperCase()}`;

    console.log(
      `[ESCALATION] Ticket: ${ticketId} | User: ${userId} | Priority: ${priority} | Reason: ${reason} | Booking: ${
        bookingId || "N/A"
      }`
    );

    // You can wire this to email, Slack webhook, or a support DB.
    // Example: await SupportTicket.create({ ticketId, userId, reason, priority, bookingId });

    return {
      success: true,
      ticketId,
      priority,
      message: `Support ticket ${ticketId} has been created with ${priority} priority. A human agent will reach out within ${
        priority === "urgent"
          ? "1 hour"
          : priority === "high"
          ? "4 hours"
          : "24 hours"
      }.`,
      nextStep:
        "Let the user know their ticket ID and expected response time. Reassure them that a human will follow up.",
    };
  },
};

// ═════════════════════════════════════════════════════════════
// EXECUTE AN ACTION
// Called by atlas.routes.js when Atlas invokes a tool.
// ═════════════════════════════════════════════════════════════

/**
 * Execute an Atlas action by name.
 *
 * @param {string} actionName  - Must match a key in executors
 * @param {Object} params      - Tool parameters from the AI
 * @param {string} userId      - Authenticated user's ID
 * @returns {Promise<Object>}  - Result fed back to Atlas
 */
export async function executeAction(actionName, params, userId) {
  const executor = executors[actionName];

  if (!executor) {
    return {
      success: false,
      error: `Unknown action: ${actionName}. Available actions: ${Object.keys(
        executors
      ).join(", ")}`,
    };
  }

  console.log(
    `[atlasActions] Executing: ${actionName} | User: ${userId} | Params:`,
    JSON.stringify(params).slice(0, 200)
  );

  try {
    const result = await executor(params, userId);
    console.log(
      `[atlasActions] ${actionName} completed:`,
      result.success ? "SUCCESS" : "FAILED"
    );
    return result;
  } catch (err) {
    console.error(`[atlasActions] ${actionName} threw:`, err.message);
    return {
      success: false,
      error: `Action failed: ${err.message}. Try again or escalate to human support.`,
    };
  }
}
