// Customer-support tools Atlas can use in chat — for signed-in travelers only.
//
// Safety rule: Atlas never cancels anything by itself. It can look up the
// traveler's own bookings and bring up a "cancel card" in the chat. The card
// shows the real refund terms (from the same cancel-quote route My Trips
// uses) and the TRAVELER taps to confirm. If automatic cancellation isn't
// possible, the card sends a cancellation request to Skyrio support, where
// a person finishes it.

import mongoose from "mongoose";
import Booking from "../models/booking.js";

export const ATLAS_SUPPORT_TOOLS = [
  {
    name: "list_my_bookings",
    description:
      "List the signed-in traveler's current bookings (confirmed or being cancelled). Use this before anything about their bookings, so you never guess.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "show_cancel_card",
    description:
      "Show the traveler a card in the chat for ONE of their bookings. The card loads the real refund terms and has the button they tap to cancel, or to send a cancellation request to Skyrio support. Call this only after list_my_bookings, once you know which booking they mean. You cannot cancel anything yourself.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The id from list_my_bookings.",
        },
      },
      required: ["bookingId"],
    },
  },
];

const dayOf = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

function startDate(b) {
  return (
    dayOf(b.dates?.start) ||
    dayOf(b.hotelStay?.rooms?.[0]?.checkin) ||
    dayOf(b.flight?.departureAt) ||
    dayOf(b.flight?.departureDate)
  );
}

/**
 * Runs one tool for a signed-in traveler.
 * Returns { result, action? } — `action` is sent to the chat UI as a card.
 */
export async function runAtlasTool(name, args, { userId }) {
  if (!userId) {
    return {
      result: {
        error:
          "The traveler isn't signed in. Ask them to log in to manage bookings.",
      },
    };
  }

  if (name === "list_my_bookings") {
    const docs = await Booking.find({
      user: userId,
      status: { $in: ["confirmed", "cancel_pending"] },
    })
      .select(
        "tripDetails type status dates hotelStay.rooms flight totalAmount total totalCurrency sharedRoom cancelRequest createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    return {
      result: {
        bookings: docs.map((b) => ({
          id: String(b._id),
          trip: b.tripDetails,
          type: b.type,
          status:
            b.status === "cancel_pending"
              ? "cancellation in progress"
              : "confirmed",
          starts: startDate(b),
          paid: Math.round(Number(b.totalAmount ?? b.total) || 0),
          currency: b.totalCurrency || "USD",
          sharedRoom: Boolean(b.sharedRoom),
          cancelRequestOpen: b.cancelRequest?.status === "open",
        })),
      },
    };
  }

  if (name === "show_cancel_card") {
    const id = String(args?.bookingId || "");
    if (!mongoose.isValidObjectId(id)) {
      return {
        result: { error: "That booking id isn't valid. Use list_my_bookings." },
      };
    }
    const b = await Booking.findOne({ _id: id, user: userId })
      .select("tripDetails type status sharedRoom cancelRequest")
      .lean();
    if (!b) {
      return {
        result: { error: "No booking with that id belongs to this traveler." },
      };
    }
    if (b.status !== "confirmed") {
      return {
        result: {
          error:
            b.status === "cancel_pending"
              ? "This booking is already being cancelled."
              : "Only confirmed bookings can be cancelled.",
        },
      };
    }
    if (b.sharedRoom) {
      return {
        result: {
          error:
            "This is a Sync Together shared room. Only the trip organizer can cancel it, from the trip page.",
        },
      };
    }
    if (b.cancelRequest?.status === "open") {
      return {
        result: {
          error:
            "A cancellation request for this booking is already with Skyrio support. They'll contact the traveler.",
        },
      };
    }
    return {
      result: {
        shown: true,
        note: "The card is now on screen. Tell the traveler to check the refund on the card and tap the button to confirm. Do not say it's cancelled.",
      },
      action: {
        type: "cancel",
        bookingId: id,
        trip: b.tripDetails,
        bookingType: b.type,
      },
    };
  }

  return { result: { error: `Unknown tool: ${name}` } };
}
