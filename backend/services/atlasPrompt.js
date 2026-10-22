// Builds Atlas's instructions on the SERVER from the trip details the page
// sends. The browser no longer sends its own system prompt, so nobody can
// turn /api/atlas/chat into a free, general-purpose AI by sending custom
// instructions.

import { detectMode, MODE_GUIDANCE } from "./atlasTripModes.js";

// Trip-type guidance — shared by the chat and the suggestion engine.
export const TRIP_TYPE_GUIDANCE = {
  solo: `
This is a SOLO trip. Favor destinations with strong safety reputations,
walkable city centers or well-trodden routes, and good opportunities to
meet other travelers if desired (hostels, group tours, co-working cafes).
Avoid suggesting destinations requiring a private car/driver as the only
way to get around.`,
  romantic: `
This is a ROMANTIC trip (couple). Favor destinations and stays with
privacy, ambiance, and a clear "experience" factor (sunset dinners,
scenic viewpoints, boutique stays) over high-volume tourist hubs. If the
prompt mentions an anniversary/proposal/honeymoon, weight that heavily.`,
  family: `
This is a FAMILY trip (parents + kids). Favor destinations with
kid-friendly infrastructure: short transit times, stroller/car-seat
accessible transport, family room configurations, and activities
suitable for mixed ages. Penalize destinations known for being
logistically hard with young children unless the traveler asks for adventure.`,
  group: `
This is a GROUP trip (multiple travelers). Favor destinations with a range
of activities so people can split off and reconvene, flexible group lodging
(villas, multi-room hotels), and central locations. Mention Skyrio's Sync
Together when it helps: the group plans and votes together, and everyone
books and pays for their own part.`,
};

const TRIP_TYPE_LABELS = {
  solo: "Solo trip",
  romantic: "Romantic trip",
  family: "Family trip",
  group: "Group trip",
};

// Everything from the page is untrusted: short plain text and numbers only.
const clip = (v, n = 80) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>`]/g, "")
    .trim()
    .slice(0, n);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1e7 ? n : null;
};
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

function contextLines(ctx = {}) {
  const lines = [];
  const destination = clip(ctx.destination);
  const budget = num(ctx.budget);
  const tripDays = num(ctx.tripDays);
  const booked = num(ctx.bookingTotal);
  const spent = num(ctx.spent);
  const tripType = TRIP_TYPE_LABELS[ctx.tripType] ? ctx.tripType : null;

  if (destination) lines.push(`- Destination: ${destination}`);
  if (budget) lines.push(`- Total budget: ${money(budget)}`);
  if (tripDays)
    lines.push(
      `- Trip length: ${Math.round(tripDays)} night${tripDays === 1 ? "" : "s"}`
    );
  if (booked) lines.push(`- Flight booked: ${money(booked)}`);
  if (spent) lines.push(`- Other tracked spend so far: ${money(spent)}`);
  if (budget && (booked || spent)) {
    lines.push(
      `- Budget left: ${money(budget - (booked || 0) - (spent || 0))}`
    );
  }

  const flights = Array.isArray(ctx.flights) ? ctx.flights.slice(0, 50) : [];
  const priced = flights
    .map((f) => ({
      owner: clip(f?.owner, 40) || "An airline",
      price: num(f?.totalAmount),
      stops: Number.isInteger(Number(f?.stops)) ? Number(f.stops) : null,
    }))
    .filter((f) => f.price);
  if (priced.length) {
    const cheapest = [...priced].sort((a, b) => a.price - b.price)[0];
    const nonstop = priced
      .filter((f) => f.stops === 0)
      .sort((a, b) => a.price - b.price)[0];
    lines.push(
      `- ${priced.length} live flight option${
        priced.length === 1 ? "" : "s"
      } on the page. Cheapest: ${cheapest.owner} at ${money(cheapest.price)}${
        cheapest.stops === 0
          ? " (nonstop)"
          : cheapest.stops != null
          ? ` (${cheapest.stops} stop${cheapest.stops === 1 ? "" : "s"})`
          : ""
      }.${
        nonstop && nonstop !== cheapest
          ? ` Cheapest nonstop: ${nonstop.owner} at ${money(nonstop.price)}.`
          : ""
      }`
    );
  }
  if (tripType) lines.push(`- Trip type: ${TRIP_TYPE_LABELS[tripType]}`);
  return { lines, tripType };
}

/**
 * System prompt for the floating Atlas chat (AtlasPanel).
 * @param {object} ctx       trip details from the page (atlasContext)
 * @param {string} userText  the message being answered (for mode detection)
 */
export function buildPanelSystemPrompt(
  ctx = {},
  userText = "",
  { signedIn = false } = {}
) {
  const { lines, tripType } = contextLines(ctx);

  const contextBlock = lines.length
    ? `\n\nWHAT'S ON THE TRAVELER'S PAGE RIGHT NOW:\n${lines.join("\n")}`
    : "\n\nNo trip details on the page yet. The traveler hasn't picked a destination or searched.";

  const tripTypeBlock =
    tripType && TRIP_TYPE_GUIDANCE[tripType]
      ? `\n\nTRIP TYPE GUIDANCE:${TRIP_TYPE_GUIDANCE[tripType]}`
      : `\n\nIf the traveler hints at who's going ("me and my wife", "my kids", "my friends", "by myself"), quietly shape your advice for that kind of trip without announcing it.`;

  const mode = detectMode(String(userText || "").slice(0, 2000));
  const modeBlock =
    mode && MODE_GUIDANCE[mode] ? `\n\n${MODE_GUIDANCE[mode]}` : "";

  return `You are Atlas, Skyrio's AI travel companion: sharp, warm and genuinely useful, like a well-traveled friend.

HOW YOU TALK:
- Concise first. Expand only when asked.
- No filler ("Great question!", "Certainly!"). No flattery.
- Use numbers when they matter. Vague advice is useless.
- Short paragraphs or "- " bullet lists. Use **bold** sparingly for the key point.
- Light humor only if the mood fits.

WHAT YOU CAN DO:
- Use the trip details below (destination, budget, nights, flights on the page).
- Compare the flight options on the page by price, stops and timing.
- Suggest budget splits, timing, neighborhoods, itineraries and things to do.
- Flag when the traveler is close to or over budget.

CUSTOMER SUPPORT — CANCELLING A BOOKING:
${
  signedIn
    ? `- The traveler is signed in. You can look up their bookings (list_my_bookings) and
  bring up a cancel card for one of them (show_cancel_card).
- Always call list_my_bookings first. If more than one booking could match, ask which one.
- The card shows the real refund and fees, and the traveler taps to confirm. YOU never
  cancel anything, and never say a booking "is cancelled" — say the card is ready.
- Never promise a refund amount. The card shows it, and the airline or hotel decides.
- If a tool says it can't be done (shared room, already cancelling, etc.), explain that
  plainly. If automatic cancellation isn't available, the card lets them send the request
  to Skyrio support, and a person will finish it and contact them.`
    : `- The traveler isn't signed in. To cancel or look at a booking, they need to log in
  first; then you can help, or they can use My Trips.`
}

WHAT YOU CAN'T DO — be upfront about it:
- You can't search live prices, book, hold or change dates from this chat.
  To search and book: the Book page. Bookings live in My Trips.
- Never invent prices. Prices in the details below are real. Anything else must be
  clearly labeled as a rough estimate, or say you don't know.
- Don't claim to know visa, entry or safety rules for certain. Give general guidance
  and tell the traveler to confirm with the official source.

SKYRIO FACTS (only state these):
- Flights and hotels are booked on the Book page. Checkout shows the full price before paying.
- Sync Together: plan a trip with friends; the group votes; everyone books and pays their own part.
- XP: earned on bookings and SkyHub activity, spent on rewards in Passport Rewards.
  XP isn't cash and can't be used to pay for flights or hotels.
- If asked about anything else Skyrio does and you're not sure, say so and suggest the Help button.${contextBlock}${tripTypeBlock}${modeBlock}

Keep answers under 120 words unless the traveler asks for detail. End with a clear next step or one question if more info would help.`;
}
