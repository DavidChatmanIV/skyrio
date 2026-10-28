// backend/services/atlas/travelerProfile.js
// Turns saved traveler ids into the passenger/guest objects LiteAPI needs.
// Runs server-side only; the model never sees DOB, legal names, or document numbers.
import User from "../../models/user.js";
import { decryptField } from "../../utils/fieldCrypto.js"; // AES-GCM helper for passport/KTN at rest
import { firstNameOf } from "./userName.js";

export class IncompleteProfileError extends Error {
  constructor(firstName, missing) {
    super(`${firstName}'s travel profile is missing: ${missing.join(", ")}`);
    this.firstName = firstName;
    this.missing = missing;
  }
}

async function resolveTravelers(userId, travelerIds) {
  const user = await User.findById(userId).lean();
  const p = user.travelProfile || {};
  const companions = new Map((p.companions || []).map((c) => [String(c._id), c]));

  return travelerIds.map((id) => {
    const t =
      id === "self"
        ? {
            firstName: p.legalFirstName || firstNameOf(user),
            lastName: p.legalLastName,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            knownTravelerNumber: p.ktnEnc ? decryptField(p.ktnEnc) : undefined,
            email: user.email,
            phone: p.phone,
          }
        : (() => {
            const c = companions.get(id);
            if (!c) throw new Error(`Unknown traveler ${id}`);
            return {
              firstName: c.legalFirstName || c.firstName,
              lastName: c.legalLastName,
              dateOfBirth: c.dateOfBirth,
              gender: c.gender,
              knownTravelerNumber: c.ktnEnc ? decryptField(c.ktnEnc) : undefined,
            };
          })();

    const missing = ["lastName", "dateOfBirth"].filter((k) => !t[k]);
    if (missing.length) throw new IncompleteProfileError(t.firstName, missing);
    return t;
  });
}

function passengerType(dob) {
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 2) return "INF";
  if (age < 12) return "CHD";
  return "ADT";
}

export async function buildPassengersFromProfile(userId, travelerIds) {
  const travelers = await resolveTravelers(userId, travelerIds);
  // Match the field names your BookingCheckout.jsx already sends to createFlightPrebook
  return travelers.map((t) => ({
    type: passengerType(t.dateOfBirth),
    firstName: t.firstName,
    lastName: t.lastName,
    birthDate: t.dateOfBirth,
    gender: t.gender,
    ...(t.knownTravelerNumber && { knownTravelerNumber: t.knownTravelerNumber }),
  }));
}

export async function buildHotelGuestsFromProfile(userId, travelerIds) {
  const travelers = await resolveTravelers(userId, travelerIds);
  return {
    holder: { firstName: travelers[0].firstName, lastName: travelers[0].lastName, email: travelers[0].email },
    guests: travelers.map((t) => ({ firstName: t.firstName, lastName: t.lastName })),
  };
}
