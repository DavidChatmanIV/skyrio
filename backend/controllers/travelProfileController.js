// backend/controllers/travelProfileController.js
// Saves the travel profile from Atlas's in-chat form card (and can back a Settings page too).
// Sensitive fields come straight from the form to here; they never pass through Atlas.
import Stripe from "stripe";
import mongoose from "mongoose";
import User from "../models/user.js";
import { encryptField, last4 } from "../utils/fieldCrypto.js";
import { firstNameOf } from "../services/atlas/userName.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const NAME = /^[A-Za-z][A-Za-z' -]{0,49}$/;
const KTN = /^[A-Za-z0-9]{8,10}$/;
const GENDERS = ["M", "F", "X"];

function validatePerson(body, { requirePhone }) {
  const errors = {};
  const out = {};

  for (const f of ["legalFirstName", "legalLastName"]) {
    const v = (body[f] || "").trim();
    if (!NAME.test(v)) errors[f] = "Use the name exactly as it appears on your ID";
    else out[f] = v;
  }
  if (body.legalMiddleName) {
    const v = body.legalMiddleName.trim();
    if (!NAME.test(v)) errors.legalMiddleName = "Letters, spaces, hyphens and apostrophes only";
    else out.legalMiddleName = v;
  }

  const dob = new Date(body.dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date() || dob.getFullYear() < 1900) {
    errors.dateOfBirth = "Enter a valid date of birth";
  } else out.dateOfBirth = body.dateOfBirth;

  if (!GENDERS.includes(body.gender)) errors.gender = "Pick the gender shown on your ID";
  else out.gender = body.gender;

  if (requirePhone) {
    const digits = (body.phone || "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) errors.phone = "Enter a valid phone number";
    else out.phone = body.phone.trim();
  }

  if (body.knownTravelerNumber) {
    const v = body.knownTravelerNumber.trim();
    if (!KTN.test(v)) errors.knownTravelerNumber = "Known Traveler Numbers are 8–10 letters or numbers";
    else out.ktnEnc = encryptField(v);
  }

  return { errors, out };
}

// What the form shows. Never returns decrypted KTN, only the last 4.
function profileView(user) {
  const p = user.travelProfile || {};
  return {
    self: {
      legalFirstName: p.legalFirstName || (user.name ? firstNameOf(user) : ""),
      legalMiddleName: p.legalMiddleName || "",
      legalLastName: p.legalLastName || "",
      dateOfBirth: p.dateOfBirth || "",
      gender: p.gender || "",
      phone: p.phone || "",
      ktnLast4: p.ktnEnc ? last4(p.ktnEnc) : null,
    },
    preferences: {
      homeAirport: user.homeAirport?.code || "",
      seatPreference: p.seatPreference || "no_preference",
      cabin: p.cabin || "economy",
    },
    companions: (p.companions || []).map((c) => ({
      id: String(c._id),
      relation: c.relation,
      legalFirstName: c.legalFirstName,
      legalLastName: c.legalLastName,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      ktnLast4: c.ktnEnc ? last4(c.ktnEnc) : null,
    })),
    card: user.defaultPaymentMethodSummary || null, // { brand, last4, expMonth, expYear }
  };
}

// GET /api/travel-profile
export async function getProfile(req, res) {
  const user = await User.findById(req.user.id).lean();
  res.json(profileView(user));
}

// PUT /api/travel-profile/self
export async function saveSelf(req, res) {
  const { errors, out } = validatePerson(req.body, { requirePhone: true });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const set = {};
  for (const [k, v] of Object.entries(out)) set[`travelProfile.${k}`] = v;

  if (req.body.homeAirport) {
    const code = req.body.homeAirport.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return res.status(400).json({ errors: { homeAirport: "Use a 3-letter code like EWR" } });
    set["homeAirport.code"] = code; // same field the Digital Passport uses
  }
  if (req.body.seatPreference) set["travelProfile.seatPreference"] = req.body.seatPreference;

  const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true }).lean();
  res.json(profileView(user));
}

// POST /api/travel-profile/companions
export async function addCompanion(req, res) {
  const { errors, out } = validatePerson(req.body, { requirePhone: false });
  if (!req.body.relation) errors.relation = "Pick who this is";
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const user = await User.findById(req.user.id);
  user.travelProfile ??= {};
  user.travelProfile.companions ??= [];
  if (user.travelProfile.companions.length >= 10) {
    return res.status(400).json({ errors: { form: "You can save up to 10 travelers" } });
  }
  user.travelProfile.companions.push({
    _id: new mongoose.Types.ObjectId(),
    relation: req.body.relation,
    firstName: out.legalFirstName,
    ...out,
  });
  user.markModified("travelProfile");
  await user.save();
  res.status(201).json(profileView(user.toObject()));
}

// PUT /api/travel-profile/companions/:id
export async function updateCompanion(req, res) {
  const { errors, out } = validatePerson(req.body, { requirePhone: false });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const user = await User.findById(req.user.id);
  const c = user.travelProfile?.companions?.find((x) => String(x._id) === req.params.id);
  if (!c) return res.status(404).json({ error: "Traveler not found" });
  Object.assign(c, out, { firstName: out.legalFirstName, relation: req.body.relation || c.relation });
  user.markModified("travelProfile");
  await user.save();
  res.json(profileView(user.toObject()));
}

// DELETE /api/travel-profile/companions/:id
export async function removeCompanion(req, res) {
  const user = await User.findById(req.user.id);
  user.travelProfile.companions = (user.travelProfile?.companions || []).filter(
    (x) => String(x._id) !== req.params.id
  );
  user.markModified("travelProfile");
  await user.save();
  res.json(profileView(user.toObject()));
}

// POST /api/travel-profile/card/setup-intent
// Starts saving a card. The card number goes to Stripe from the browser, never to Skyrio.
export async function createCardSetupIntent(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user._id) } });
    user.stripeCustomerId = customer.id;
    await user.save();
  }
  const si = await stripe.setupIntents.create({
    customer: user.stripeCustomerId,
    usage: "on_session",
    automatic_payment_methods: { enabled: true },
    metadata: { userId: String(user._id), source: "atlas_profile" },
  });
  res.json({ clientSecret: si.client_secret });
}

// POST /api/travel-profile/card/confirm  { setupIntentId }
export async function saveConfirmedCard(req, res) {
  const user = await User.findById(req.user.id);
  const si = await stripe.setupIntents.retrieve(req.body.setupIntentId, { expand: ["payment_method"] });

  if (si.customer !== user.stripeCustomerId || si.status !== "succeeded") {
    return res.status(400).json({ error: "Card wasn't saved. Please try again." });
  }

  const pm = si.payment_method;
  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: pm.id },
  });
  user.defaultPaymentMethodId = pm.id;
  user.defaultPaymentMethodSummary = pm.card
    ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
    : { brand: pm.type, last4: null };
  await user.save();
  res.json(profileView(user.toObject()));
}
